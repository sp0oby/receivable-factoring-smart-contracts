// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReceivableNFT} from "./ReceivableNFT.sol";
import {Pricing} from "./lib/Pricing.sol";

/// @notice ERC-4626 vault that buys receivable NFTs at a utilization-based discount.
/// @dev Position uses denormalized {maturity, debtor} at funding time to avoid external Term reads in hot paths.
contract FactoringVault is ERC4626, AccessControl, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    ReceivableNFT public immutable receivable;
    Pricing.Params public pricingParams;
    uint16 public maxUtilizationBps;

    enum Status {
        None,
        Active,
        Repaid,
        Defaulted
    }

    struct Position {
        Status status;
        uint48 maturity;
        address debtor;
        uint256 remainingFace;
    }

    mapping(uint256 tokenId => Position) public positions;
    uint256 public totalFaceOutstanding;
    uint256[] public activeInvoices;
    mapping(uint256 tokenId => uint256 indexPlusOne) private _activeIndexPlusOne;

    event ReceivablePurchased(
        uint256 indexed tokenId, address indexed seller, uint256 advance, uint256 nominal, uint256 newTotalFace
    );
    event RepaymentApplied(uint256 indexed tokenId, uint256 amount, uint256 remainingFace);
    event ReceivableDefaulted(uint256 indexed tokenId, uint256 loss);

    error InvalidToken();
    error NotSeller();
    error AlreadyFunded();
    error InsufficientLiquidity();
    error UtilizationCap();
    error NotActive();
    error NotDebtor();
    error ZeroAmount();
    error Overpay();
    error NotMatured();

    constructor(
        IERC20 asset_,
        ReceivableNFT receivable_,
        address admin,
        Pricing.Params memory pricing_,
        uint16 maxUtilizationBps_
    ) ERC20("Factoring Vault", "fvRCV") ERC4626(asset_) {
        receivable = receivable_;
        pricingParams = pricing_;
        maxUtilizationBps = maxUtilizationBps_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setPricingParams(Pricing.Params memory p) external onlyRole(DEFAULT_ADMIN_ROLE) {
        pricingParams = p;
    }

    function setMaxUtilizationBps(uint16 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxUtilizationBps = bps;
    }

    /// @dev Idle ERC-20 balance plus outstanding face value (until default write-off).
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + totalFaceOutstanding;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function _addActive(uint256 tokenId) internal {
        unchecked {
            _activeIndexPlusOne[tokenId] = activeInvoices.length + 1;
        }
        activeInvoices.push(tokenId);
    }

    function _removeActive(uint256 tokenId) internal {
        uint256 i1 = _activeIndexPlusOne[tokenId];
        if (i1 == 0) return;
        unchecked {
            uint256 idx = i1 - 1;
            uint256 last = activeInvoices[activeInvoices.length - 1];
            activeInvoices[idx] = last;
            _activeIndexPlusOne[last] = idx + 1;
            activeInvoices.pop();
        }
        delete _activeIndexPlusOne[tokenId];
    }

    /// @dev Computes advance and new utilization state; reverts if liquidity or cap fails.
    function _computePurchase(
        uint256 nominal,
        uint256 idle,
        uint256 faceOut
    ) internal view returns (uint256 advance, uint256 newFace) {
        uint256 tvl = idle + faceOut;
        uint256 utilBps = 0;
        if (tvl != 0) {
            unchecked {
                utilBps = (faceOut * 10_000) / tvl;
            }
        }
        uint16 disc = Pricing.discountBps(utilBps, pricingParams);
        unchecked {
            advance = (nominal * (10_000 - uint256(disc))) / 10_000;
        }
        if (advance > idle) revert InsufficientLiquidity();
        newFace = faceOut + nominal;
        uint256 newIdle = idle - advance;
        unchecked {
            if ((newFace * 10_000) / (newIdle + newFace) > maxUtilizationBps) revert UtilizationCap();
        }
    }

    /// @notice Seller funds sale: transfers NFT to vault, receives advance in `asset`.
    /// @dev CEI: state updates before external ERC-721 transfer and ERC-20 payout (reentrancy-safe ordering).
    function purchaseReceivable(uint256 tokenId) external nonReentrant {
        ReceivableNFT.Terms memory t = receivable.getTerms(tokenId);
        if (t.nominal == 0) revert InvalidToken();
        if (IERC721(address(receivable)).ownerOf(tokenId) != msg.sender) revert NotSeller();

        Position storage p = positions[tokenId];
        if (p.status != Status.None) revert AlreadyFunded();

        IERC20 assetERC20 = IERC20(asset());
        uint256 idle = assetERC20.balanceOf(address(this));
        (uint256 advance, uint256 newFace) = _computePurchase(t.nominal, idle, totalFaceOutstanding);

        p.status = Status.Active;
        p.maturity = t.due;
        p.debtor = t.debtor;
        p.remainingFace = t.nominal;
        totalFaceOutstanding = newFace;
        _addActive(tokenId);

        IERC721(address(receivable)).transferFrom(msg.sender, address(this), tokenId);
        assetERC20.safeTransfer(msg.sender, advance);

        emit ReceivablePurchased(tokenId, msg.sender, advance, t.nominal, newFace);
    }

    /// @notice Debtor repays with `asset` pulled from `msg.sender`.
    /// @dev Matches ERC-4626 deposit ordering: `transferFrom` must run before reducing `remainingFace` / `totalFaceOutstanding`
    ///      so `totalAssets()` (idle + face) does not transiently misstate vault economics during a token hook. `nonReentrant` blocks
    ///      same-contract reentrancy; cross-view reads during hooks see a conservative surplus of face vs idle, not a shortfall.
    // slither-disable-start reentrancy-no-eth
    function repay(uint256 tokenId, uint256 amount) external nonReentrant {
        Position storage p = positions[tokenId];
        if (p.status != Status.Active) revert NotActive();
        if (msg.sender != p.debtor) revert NotDebtor();

        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);
        _applyRepayment(tokenId, amount, p);
    }

    // slither-disable-end reentrancy-no-eth

    /// @notice Oracle attestation: reduces outstanding face. **Trust:** `ORACLE_ROLE`.
    function applyExternalSettlement(uint256 tokenId, uint256 repaidAmount) external onlyRole(ORACLE_ROLE) nonReentrant {
        Position storage p = positions[tokenId];
        _applyRepayment(tokenId, repaidAmount, p);
    }

    function _applyRepayment(uint256 tokenId, uint256 amount, Position storage p) internal {
        if (p.status != Status.Active) revert NotActive();
        if (amount == 0) revert ZeroAmount();
        if (amount > p.remainingFace) revert Overpay();

        unchecked {
            p.remainingFace -= amount;
            totalFaceOutstanding -= amount;
        }
        emit RepaymentApplied(tokenId, amount, p.remainingFace);

        if (p.remainingFace == 0) {
            p.status = Status.Repaid;
            _removeActive(tokenId);
            receivable.burnFromVault(tokenId, address(this));
        }
    }

    // slither-disable-start timestamp
    /// @notice Mark default after maturity while still active.
    function markDefaulted(uint256 tokenId) external nonReentrant {
        Position storage p = positions[tokenId];
        if (p.status != Status.Active) revert NotActive();
        if (block.timestamp <= uint256(p.maturity)) revert NotMatured();

        uint256 loss = p.remainingFace;
        unchecked {
            totalFaceOutstanding -= loss;
        }
        p.remainingFace = 0;
        p.status = Status.Defaulted;
        _removeActive(tokenId);
        receivable.burnFromVault(tokenId, address(this));

        emit ReceivableDefaulted(tokenId, loss);
    }

    // slither-disable-end timestamp

    /// @dev Chainlink Automation helper: first overdue active id (no external Term lookups per iteration).
    // slither-disable-start timestamp
    function peekNextDefaultable() external view returns (bool upkeepNeeded, uint256 tokenId) {
        uint256 n = activeInvoices.length;
        uint256 ts = block.timestamp;
        for (uint256 i = 0; i < n;) {
            uint256 id = activeInvoices[i];
            Position storage p = positions[id];
            if (p.status == Status.Active && ts > uint256(p.maturity)) {
                return (true, id);
            }
            unchecked {
                ++i;
            }
        }
        return (false, 0);
    }

    // slither-disable-end timestamp

    function activeLength() external view returns (uint256) {
        return activeInvoices.length;
    }
}
