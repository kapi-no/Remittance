pragma solidity 0.5.7;

import '../node_modules/openzeppelin-solidity/contracts/lifecycle/Pausable.sol';
import '../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';

contract Remittance is Pausable, Ownable {
    event LogFundLock(address indexed sender, uint amount, bytes32 indexed accessHash);
    event LogFundClaim(address indexed sender, bytes32 indexed accessHash);

    struct LockedFunds {
        uint balance;
        bool used;
    }

    mapping (bytes32 => LockedFunds) public lockedFunds; // remittanceAccessHash => (balance, usedHash flag)

    function computeAccessHash(bytes32 secret, address remittanceAddress)
        public pure returns (bytes32 accessHash) {
        accessHash = keccak256(abi.encodePacked(secret, remittanceAddress));

        return accessHash;
    }

    function lockFunds(bytes32 accessHash) public payable whenNotPaused returns (bool success) {
        require(accessHash != bytes32(0));
        require(!lockedFunds[accessHash].used);
        require(msg.value > 0);

        lockedFunds[accessHash].balance = msg.value;
        lockedFunds[accessHash].used = true;

        emit LogFundLock(msg.sender, msg.value, accessHash);

        return true;
    }

    function claimFunds(bytes32 secret) public
        whenNotPaused returns (bool success) {

        bytes32 accessHash = computeAccessHash(secret, msg.sender);
        uint senderBalance = lockedFunds[accessHash].balance;

        require(senderBalance > 0);

        emit LogFundClaim(msg.sender, accessHash);

        lockedFunds[accessHash].balance = 0;
        msg.sender.transfer(senderBalance);

        return true;
    }

    function kill() public onlyOwner {
        // Casting vanilla address type to payable address type.
        address payable owner = address(uint160(address(owner())));

        selfdestruct(owner);
    }

}