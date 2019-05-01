pragma solidity 0.5.7;

import '../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol';
import '../node_modules/openzeppelin-solidity/contracts/lifecycle/Pausable.sol';
import '../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';

contract Remittance is Pausable, Ownable {
    using SafeMath for uint;

    event LogFundLock(address indexed sender, uint amount, bytes32 indexed accessHash);
    event LogFundClaim(address indexed sender, bytes32 indexed accessHash);

    mapping (bytes32 => uint) public balances; // remittanceAccessHash => funds
    mapping (bytes32 => bool) public usedHashes; // remittanceAccessHash => usedHash flag

    function computeAccessHash(bytes memory secret, bytes32 saltValue, address remittanceAddress)
        public pure returns (bytes32 accessHash) {
        accessHash = keccak256(abi.encodePacked(secret, saltValue, remittanceAddress));

        return accessHash;
    }

    function lockFunds(bytes32 accessHash) public payable whenNotPaused returns (bool success) {
        require(accessHash != bytes32(0));
        require(!usedHashes[accessHash]);
        require(msg.value > 0);

        balances[accessHash] = balances[accessHash].add(msg.value);

        emit LogFundLock(msg.sender, msg.value, accessHash);

        return true;
    }

    function claimFunds(bytes memory secret, bytes32 saltValue) public
        whenNotPaused returns (bool success) {

        bytes32 accessHash = computeAccessHash(secret, saltValue, msg.sender);
        uint senderBalance = balances[accessHash];

        require(senderBalance > 0);

        emit LogFundClaim(msg.sender, accessHash);

        balances[accessHash] = 0;
        usedHashes[accessHash] = true;
        msg.sender.transfer(senderBalance);

        return true;
    }

    function kill() public onlyOwner {
        // Casting vanilla address type to payable address type.
        address payable owner = address(uint160(address(owner())));

        selfdestruct(owner);
    }

}