pragma solidity 0.5.7;

import '../node_modules/openzeppelin-solidity/contracts/lifecycle/Pausable.sol';
import '../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';
import '../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol';

contract Remittance is Pausable, Ownable {
    using SafeMath for uint;

    event LogFundLocked(address indexed sender, uint amount,
        bytes32 indexed accessHash, uint deadline);
    event LogFundCanceled(address indexed sender, bytes32 indexed accessHash);
    event LogFundClaimed(address indexed sender, bytes32 indexed accessHash);

    event LogMaxLockPeriodChanged(address indexed sender, uint maxLockPeriod);

    struct LockedFunds {
        uint balance;
        uint deadline;
        address owner;
    }

    uint public maxLockPeriod; // in seconds
    mapping (bytes32 => LockedFunds) public lockedFunds; // remittanceAccessHash => (balance, usedHash flag)

    constructor(uint _maxLockPeriod) public {
        maxLockPeriod = _maxLockPeriod;

        emit LogMaxLockPeriodChanged(msg.sender, _maxLockPeriod);
    }

    function computeAccessHashInternal(bytes32 secret, address remittanceAddress)
        private view returns (bytes32 accessHash) {
        require(secret != bytes32(0),
            "secret parameter cannot be equal to 0");
        require(remittanceAddress != address(0),
            "remittanceAddress parameter cannot be equal to 0");

        accessHash = keccak256(abi.encodePacked(secret, address(this), remittanceAddress));
    }

    function computeAccessHash(bytes32 secret, address remittanceAddress)
        public view returns (bytes32 accessHash) {
        accessHash = computeAccessHashInternal(secret, remittanceAddress);

        require(lockedFunds[accessHash].owner == address(0),
            "accessHash has already been used");
    }

    function lockFunds(bytes32 accessHash, uint lockPeriod) public payable
    whenNotPaused returns (bool success) {
        LockedFunds storage funds = lockedFunds[accessHash];

        require(accessHash != bytes32(0));
        require(funds.owner == address(0));
        require(msg.value > 0);
        require(lockPeriod <= maxLockPeriod);

        uint deadline = now.add(lockPeriod);

        funds.balance = msg.value;
        funds.deadline = deadline;
        funds.owner = msg.sender;

        emit LogFundLocked(msg.sender, msg.value, accessHash, deadline);

        return true;
    }

    function cancelFunds(bytes32 accessHash) public
        whenNotPaused returns (bool success) {
        LockedFunds storage funds = lockedFunds[accessHash];

        require(funds.owner == msg.sender);
        require(funds.deadline <= now);

        uint senderBalance = funds.balance;

        require(senderBalance > 0);

        emit LogFundCanceled(msg.sender, accessHash);

        funds.balance = 0;
        funds.deadline = 0;
        msg.sender.transfer(senderBalance);

        return true;
    }

    function claimFunds(bytes32 secret) public
        whenNotPaused returns (bool success) {

        bytes32 accessHash = computeAccessHashInternal(secret, msg.sender);
        LockedFunds storage funds = lockedFunds[accessHash];

        uint senderBalance = funds.balance;

        require(senderBalance > 0);

        emit LogFundClaimed(msg.sender, accessHash);

        funds.balance = 0;
        funds.deadline = 0;
        msg.sender.transfer(senderBalance);

        return true;
    }

    function changeMaxLockPeriod(uint newMaxLockPeriod) public onlyOwner {
        maxLockPeriod = newMaxLockPeriod;

        emit LogMaxLockPeriodChanged(msg.sender, newMaxLockPeriod);
    }

    function kill() public onlyOwner {
        // Casting vanilla address type to payable address type.
        address payable owner = address(uint160(address(owner())));

        selfdestruct(owner);
    }

}