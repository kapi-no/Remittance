pragma solidity 0.5.7;

import '../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol';
import '../node_modules/openzeppelin-solidity/contracts/lifecycle/Pausable.sol';

contract Remittance is Pausable {
    using SafeMath for uint;

    event LogFundLock(address indexed sender, uint amount, bytes32 indexed accessHash);
    event LogFundClaim(address indexed sender, bytes indexed secret);

    mapping (bytes32 => uint) public balances; // remittanceAccessHash => funds

    function lockFunds(bytes32 accessHash) public payable whenNotPaused returns (bool success) {
        require(accessHash != bytes32(0));
        require(msg.value > 0);

        balances[accessHash] = balances[accessHash].add(msg.value);

        emit LogFundLock(msg.sender, msg.value, accessHash);

        return true;
    }

    function claimFunds(bytes memory secret) public
        whenNotPaused returns (bool success) {

        bytes32 accessHash = keccak256(abi.encodePacked(secret, msg.sender));
        uint senderBalance = balances[accessHash];

        require(senderBalance > 0);

        emit LogFundClaim(msg.sender, secret);

        balances[accessHash] = 0;
        msg.sender.transfer(senderBalance);

        return true;
    }

}