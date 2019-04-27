pragma solidity 0.5.7;

import '../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol';
import '../node_modules/openzeppelin-solidity/contracts/lifecycle/Pausable.sol';

contract Remittance is Pausable {
    using SafeMath for uint;

    event LogFundLock(address indexed sender, uint indexed amount, bytes32 indexed password);
    event LogFundClaim(address indexed sender, bytes indexed firstSecret, bytes indexed secondSecret);

    mapping (bytes32 => uint) public balances;

    function lockFunds(bytes32 password) public payable whenNotPaused returns (bool success) {
        require(password != bytes32(0));
        require(msg.value > 0);

        balances[password] = balances[password].add(msg.value);

        emit LogFundLock(msg.sender, msg.value, password);

        return true;
    }

    function claimFunds(bytes memory firstSecret, bytes memory secondSecret) public
        whenNotPaused returns (bool success) {

        bytes32 password = keccak256(abi.encodePacked(firstSecret, secondSecret, msg.sender));
        uint senderBalance = balances[password];

        require(senderBalance > 0);

        emit LogFundClaim(msg.sender, firstSecret, secondSecret);

        balances[password] = 0;
        msg.sender.transfer(senderBalance);

        return true;
    }

}