const truffleAssert = require('truffle-assertions');

const Remittance = artifacts.require('Remittance');

const { BN, soliditySha3 } = web3.utils;

function sleep(s) {
    return new Promise(resolve => setTimeout(resolve, 1000*s));
}

contract('Remittance', (accounts) => {

    let remittanceInstance;

    let carolAddress;

    beforeEach('setup contract for each test', async function () {
        const defaultMaxLockPeriod = 100*24*3600; // 100 days.

        remittanceInstance = await Remittance.new(defaultMaxLockPeriod, {from: accounts[0]});

        carolAddress = accounts[1];
    });

    it('should kill the contract', async () => {
        await remittanceInstance.kill({from: accounts[0]});

        const contractCode = await web3.eth.getCode(remittanceInstance.address);

        assert.strictEqual(contractCode, "0x", "Contract code should be empty");
    });

    it('should change the maximum period in which funds are locked', async () => {
        const newMaxLockPeriod = 9*24*3600; // 9 days.
        const owner = await remittanceInstance.owner();

        await remittanceInstance.changeMaxLockPeriod(newMaxLockPeriod, {from: owner})

        const maxLockPeriod = await remittanceInstance.maxLockPeriod();

        assert.strictEqual(maxLockPeriod.toString(), newMaxLockPeriod.toString(),
            "Lock periods do not match");
    });

    it('should compute the same hash at the client side and inside solidity', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const secret = soliditySha3("password", latestBlock.hash);

        const accessHash = soliditySha3(secret, remittanceInstance.address, accounts[0]);
        const solAccessHash = await remittanceInstance.computeAccessHash(secret, accounts[0]);

        assert.strictEqual(solAccessHash, accessHash, "Hashes do not match");
    });

    it('should not compute the hash with 0 hash', async () => {
        const zeroSecret = "0x0000000000000000000000000000000000000000000000000000000000000000";

        const accessHash = soliditySha3(zeroSecret, remittanceInstance.address, carolAddress);
        const solAccessHash = await remittanceInstance.computeAccessHash(zeroSecret, carolAddress);

        assert.ok(solAccessHash != accessHash, "solAccessHash should not be calculated");
    });

    it('should not compute the hash with 0 address', async () => {
        const zeroAddress = "0x0000000000000000000000000000000000000000";

        const latestBlock = await web3.eth.getBlock("latest");
        const secret = soliditySha3("password", latestBlock.hash);
        const accessHash = soliditySha3(secret, remittanceInstance.address, zeroAddress);

        const solAccessHash = await remittanceInstance.computeAccessHash(secret, zeroAddress);

        assert.ok(solAccessHash != accessHash, "solAccessHash should not be calculated");
    });

    it('should lock the funds in the contract', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const secret = soliditySha3("password", latestBlock.hash);
        const accessHash = await remittanceInstance.computeAccessHash(secret, accounts[0]);
        const value = 10;

        await remittanceInstance.lockFunds(accessHash, 0, {from: accounts[0], value: value});

        const lockedValue = (await remittanceInstance.lockedFunds(accessHash))[0];
        assert.strictEqual(lockedValue.toString(), value.toString(), "Locked value is not correct");
    });

    it('should lock two different funds in the contract', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const secret1 = soliditySha3("password1", latestBlock.hash);
        const secret2 = soliditySha3("password2", latestBlock.hash);
        const accessHash1 = await remittanceInstance.computeAccessHash(secret1, accounts[0]);
        const accessHash2 = await remittanceInstance.computeAccessHash(secret2, accounts[0]);
        const value1 = 10;
        const value2 = 11;

        await remittanceInstance.lockFunds(accessHash1, 0, {from: accounts[0], value: value1});
        await remittanceInstance.lockFunds(accessHash2, 0, {from: accounts[0], value: value2});

        const lockedValue1 = (await remittanceInstance.lockedFunds(accessHash1))[0];
        assert.strictEqual(lockedValue1.toString(), value1.toString(), "Locked value is not correct");

        const lockedValue2 = (await remittanceInstance.lockedFunds(accessHash2))[0];
        assert.strictEqual(lockedValue2.toString(), value2.toString(), "Locked value is not correct");
    });

    it('claim the locked funds in the contract', async () => {
        const gasPrice = 21;
        const value = 10;
        const latestBlock = await web3.eth.getBlock("latest");
        const secret = soliditySha3("password", latestBlock.hash);
        const accessHash = await remittanceInstance.computeAccessHash(secret, carolAddress);

        const carolPreBalance = await web3.eth.getBalance(carolAddress);

        await remittanceInstance.lockFunds(accessHash, 0, {from: accounts[0], value: value});
        const carolTxObj = await remittanceInstance.claimFunds(secret,
            {from: carolAddress, gasPrice: gasPrice});

        const carolBalanceChange = new BN(value - carolTxObj.receipt.gasUsed * gasPrice);
        const expectedCarolBalance = new BN(carolPreBalance).add(carolBalanceChange);
        const carolBalance = await web3.eth.getBalance(carolAddress);

        assert.strictEqual(carolTxObj.receipt.status, true, "Carol TX failed");
        assert.strictEqual(carolBalance, expectedCarolBalance.toString(),
                            "Carol balance is not correct");
    });

    it('should not lock fund with already used access hash', async () => {
        const value = 10;
        const latestBlock = await web3.eth.getBlock("latest");
        const secret = soliditySha3("password", latestBlock.hash);
        const accessHash = await remittanceInstance.computeAccessHash(secret, carolAddress);

        await remittanceInstance.lockFunds(accessHash, 0, {from: accounts[0], value: value});
        await remittanceInstance.claimFunds(secret, {from: carolAddress});

        await truffleAssert.fails(remittanceInstance.lockFunds(accessHash, 0,
            {from: accounts[0], value: value}));
    });

    it('claim without locking', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const secret = soliditySha3("password", latestBlock.hash);

        await truffleAssert.fails(remittanceInstance.claimFunds(secret, {from: carolAddress}));
    });

    it('should cancel the locking operation', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const secret = soliditySha3("password", latestBlock.hash);
        const accessHash = await remittanceInstance.computeAccessHash(secret, carolAddress);
        const aliceAddress = accounts[2];
        const gasPrice = 21;
        const value = 10;

        const alicePreBalance = await web3.eth.getBalance(aliceAddress);

        const aliceLockTxObj = await remittanceInstance.lockFunds(accessHash, 0,
            {from: aliceAddress, value: value, gasPrice: gasPrice});
        const aliceCancelTxObj = await remittanceInstance.cancelFunds(accessHash,
            {from: aliceAddress, gasPrice: gasPrice});

        const aliceTransactionCost = new BN((aliceCancelTxObj.receipt.gasUsed +
            aliceLockTxObj.receipt.gasUsed) * gasPrice);
        const expectedAliceBalance = new BN(alicePreBalance).sub(aliceTransactionCost);
        const aliceBalance = await web3.eth.getBalance(aliceAddress);

        assert.strictEqual(aliceBalance, expectedAliceBalance.toString(),
                            "Alice balance is not correct");
    });

    it('should not cancel the locking operation before the lock period expires', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const secret = soliditySha3("password", latestBlock.hash);
        const accessHash = await remittanceInstance.computeAccessHash(secret, carolAddress);
        const lockPeriod = 5*24*3600; // 5 days
        const value = 10;

        await remittanceInstance.lockFunds(accessHash, lockPeriod, {from: accounts[0], value: value});

        const lockedFunds = await remittanceInstance.lockedFunds(accessHash);
        assert.strictEqual(lockedFunds[0].toString(), value.toString(), "Locked value is not correct");
        assert.strictEqual(lockedFunds[2].toString(), accounts[0].toString(), "Locked fund owner is not correct");

        await truffleAssert.fails(remittanceInstance.cancelFunds(accessHash, {from: accounts[0]}));
    });

    it('should cancel the locking operation after the lock period expires', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const secret = soliditySha3("password", latestBlock.hash);
        const accessHash = await remittanceInstance.computeAccessHash(secret, carolAddress);
        const lockPeriod = 3; // 3 seconds
        const value = 10;

        await remittanceInstance.lockFunds(accessHash, lockPeriod, {from: accounts[0], value: value});

        let lockedFunds = await remittanceInstance.lockedFunds(accessHash);
        assert.strictEqual(lockedFunds[0].toString(), value.toString(), "Locked value is not correct");
        assert.strictEqual(lockedFunds[2].toString(), accounts[0].toString(), "Locked fund owner is not correct");

        await sleep(lockPeriod);

        await remittanceInstance.cancelFunds(accessHash, {from: accounts[0]});

        lockedFunds = await remittanceInstance.lockedFunds(accessHash);
        assert.strictEqual(lockedFunds[0].toString(), "0", "Locked value is not correct");
        assert.strictEqual(lockedFunds[2].toString(), accounts[0].toString(), "Locked fund owner is not correct");
    });

    it('should be able to claim the locked funds before the lock period expires', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const secret = soliditySha3("password", latestBlock.hash);
        const accessHash = await remittanceInstance.computeAccessHash(secret, carolAddress);
        const lockPeriod = 5*24*3600; // 5 days
        const value = 10;

        await remittanceInstance.lockFunds(accessHash, lockPeriod, {from: accounts[0], value: value});

        let lockedFunds = await remittanceInstance.lockedFunds(accessHash);
        assert.strictEqual(lockedFunds[0].toString(), value.toString(), "Locked value is not correct");
        assert.strictEqual(lockedFunds[2].toString(), accounts[0].toString(), "Locked fund owner is not correct");

        await remittanceInstance.claimFunds(secret, {from: carolAddress});

        lockedFunds = await remittanceInstance.lockedFunds(accessHash);
        assert.strictEqual(lockedFunds[0].toString(), "0", "Locked value is not correct");
        assert.strictEqual(lockedFunds[2].toString(), accounts[0].toString(), "Locked fund owner is not correct");
    });

    it('should not be able to cancel the locking operation when funds are already claimed', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const secret = soliditySha3("password", latestBlock.hash);
        const accessHash = await remittanceInstance.computeAccessHash(secret, carolAddress);
        const lockPeriod = 5*24*3600; // 5 days
        const value = 10;

        await remittanceInstance.lockFunds(accessHash, lockPeriod, {from: accounts[0], value: value});

        let lockedFunds = await remittanceInstance.lockedFunds(accessHash);
        assert.strictEqual(lockedFunds[0].toString(), value.toString(), "Locked value is not correct");
        assert.strictEqual(lockedFunds[2].toString(), accounts[0].toString(), "Locked fund owner is not correct");

        await remittanceInstance.claimFunds(secret, {from: carolAddress});

        lockedFunds = await remittanceInstance.lockedFunds(accessHash);
        assert.strictEqual(lockedFunds[0].toString(), "0", "Locked value is not correct");
        assert.strictEqual(lockedFunds[2].toString(), accounts[0].toString(), "Locked fund owner is not correct");

        await truffleAssert.fails(remittanceInstance.cancelFunds(accessHash, {from: accounts[0]}));
    });

});