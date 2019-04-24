pragma solidity 0.5.7;

import '../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol';
import '../node_modules/openzeppelin-solidity/contracts/lifecycle/Pausable.sol';

contract Remittance is Pausable {
    using SafeMath for uint;

    event LogFundLock(address indexed _funder, bytes32 indexed _password, uint _value);
    event LogFundClaim(address indexed _recipient, bytes32 indexed _password);

    mapping (bytes32 => uint) public balances;

    function lockFunds(bytes32 password) public payable whenNotPaused returns (bool success) {
        require(password != bytes32(0));
        require(msg.value > 0);

        balances[password] = balances[password].add(msg.value);

        emit LogFundLock(msg.sender, password, msg.value);

        return true;
    }

    function claimFunds(bytes memory firstSecret, bytes memory secondSecret) public
        whenNotPaused returns (bool success) {

        bytes32 password = keccak256(abi.encodePacked(firstSecret, secondSecret));
        uint senderBalance = balances[password];

        require(senderBalance > 0);

        emit LogFundClaim(msg.sender, password);

        balances[password] = 0;
        msg.sender.transfer(senderBalance);

        return true;
    }

}