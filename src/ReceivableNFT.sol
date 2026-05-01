// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title ERC-721 representing one receivable / invoice commitment.
/// @dev Mints with `_mint` (not `_safeMint`) to save gas; recipients MUST be EOAs or contracts that do not rely on `onERC721Received`.
contract ReceivableNFT is ERC721URIStorage, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Terms {
        uint256 nominal;
        uint48 due;
        address debtor;
        bytes32 commitment;
    }

    uint256 private _nextId = 1;
    mapping(uint256 tokenId => Terms) private _terms;

    error ZeroAddress();
    error OnlyVault();

    function terms(uint256 tokenId) external view returns (uint256 nominal, uint48 due, address debtor, bytes32 commitment) {
        Terms storage t = _terms[tokenId];
        return (t.nominal, t.due, t.debtor, t.commitment);
    }

    function getTerms(uint256 tokenId) external view returns (Terms memory) {
        return _terms[tokenId];
    }

    constructor(address admin) ERC721("RWA Receivable", "RCVBL") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    function mint(address to, uint256 nominal, uint48 due, address debtor, bytes32 commitment, string calldata tokenUri_)
        external
        onlyRole(ISSUER_ROLE)
        returns (uint256 tokenId)
    {
        if (to == address(0) || debtor == address(0)) revert ZeroAddress();
        tokenId = _nextId++;
        _terms[tokenId] = Terms({nominal: nominal, due: due, debtor: debtor, commitment: commitment});
        _mint(to, tokenId);
        if (bytes(tokenUri_).length > 0) {
            _setTokenURI(tokenId, tokenUri_);
        }
    }

    /// @dev Called by trusted vault to burn settled receivables.
    function burnFromVault(uint256 tokenId, address vault) external {
        if (msg.sender != vault) revert OnlyVault();
        _burn(tokenId);
        delete _terms[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
