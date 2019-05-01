const truffleAssert = require('truffle-assertions');

const Remittance = artifacts.require('Remittance');

const BN = web3.utils.BN;
const Sha3 = web3.utils.soliditySha3;

contract('Remittance', (accounts) => {

    let remittanceInstance;

    let carolAddress;

    beforeEach('setup contract for each test', async function () {
        remittanceInstance = await Remittance.new({from: accounts[0]});

        carolAddress = accounts[1];
    });

    it('should kill the contract', async () => {
        await remittanceInstance.kill({from: accounts[0]});

        await truffleAssert.fails(
            remittanceInstance.lockedFunds(Sha3("string1")));
    });

    it('should compute the same hash at the client side and inside solidity', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const secret = Sha3("string1", latestBlock.hash);
        const accessHash = Sha3(secret, accounts[0]);

        const solAccessHash = await remittanceInstance.computeAccessHash(secret, accounts[0]);

        assert.strictEqual(solAccessHash, accessHash, "Hashes do not match");
    });

    it('should lock the funds in the contract', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const accessHash = Sha3(Sha3("string1", latestBlock.hash), accounts[0]);
        const value = 10;

        await remittanceInstance.lockFunds(accessHash, 0, {from: accounts[0], value: value});

        const lockedValue = (await remittanceInstance.lockedFunds(accessHash))[0];
        assert.strictEqual(lockedValue.toString(), value.toString(), "Locked value is not correct");
    });

    it('should lock two different funds in the contract', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const accessHash1 = Sha3(Sha3("string1", latestBlock.hash), accounts[0]);
        const accessHash2 = Sha3(Sha3("string2", latestBlock.hash), accounts[0]);
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
        const secret = "string1";
        const latestBlock = await web3.eth.getBlock("latest");

        const carolPreBalance = await web3.eth.getBalance(carolAddress);

        await remittanceInstance.lockFunds(Sha3(Sha3(secret, latestBlock.hash), carolAddress), 0,
            {from: accounts[0], value: value});
        const carolTxObj = await remittanceInstance.claimFunds(
            Sha3(secret, latestBlock.hash),
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
        const secret = "string1";
        const latestBlock = await web3.eth.getBlock("latest");

        await remittanceInstance.lockFunds(Sha3(Sha3(secret, latestBlock.hash), carolAddress), 0,
            {from: accounts[0], value: value});
        await remittanceInstance.claimFunds(Sha3(secret, latestBlock.hash), {from: carolAddress});

        await truffleAssert.fails(remittanceInstance.lockFunds(
            Sha3(Sha3(secret, latestBlock.hash), carolAddress), 0,
            {from: accounts[0], value: value}));
    });

    it('claim without locking', async () => {
        const secret = "string1";
        const latestBlock = await web3.eth.getBlock("latest");

        await truffleAssert.fails(remittanceInstance.claimFunds(
            Sha3(secret, latestBlock.hash), {from: carolAddress}));
    });

    it('should cancel the locking operation', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const accessHash = Sha3(Sha3("string1", latestBlock.hash), carolAddress);
        const aliceAddress = accounts[2];
        const gasPrice = 21;
        const value = 10;

        const alicePreBalance = await web3.eth.getBalance(aliceAddress);

        const aliceLockTxObj = await remittanceInstance.lockFunds(accessHash, 0,
            {from: aliceAddress, value: value, gasPrice: gasPrice});
        const aliceCancelTxObj = await remittanceInstance.cancelFunds(accessHash,
            {from: aliceAddress, gasPrice: gasPrice});

        const aliceBalanceChange = new BN((aliceCancelTxObj.receipt.gasUsed +
            aliceLockTxObj.receipt.gasUsed) * gasPrice * (-1));
        const expectedAliceBalance = new BN(alicePreBalance).add(aliceBalanceChange);
        const aliceBalance = await web3.eth.getBalance(aliceAddress);

        assert.strictEqual(aliceBalance, expectedAliceBalance.toString(),
                            "Alice balance is not correct");
    });

    it('should not cancel the locking operation before the lock period expires', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const accessHash = Sha3(Sha3("string1", latestBlock.hash), carolAddress);
        const lockPeriod = 5;
        const value = 10;

        await remittanceInstance.lockFunds(accessHash, lockPeriod, {from: accounts[0], value: value});

        await truffleAssert.fails(remittanceInstance.cancelFunds(accessHash, {from: accounts[0]}));
    });


    it('should be able to claim the locked funds before the lock period expires', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const secret = Sha3("string1", latestBlock.hash);
        const accessHash = Sha3(secret, carolAddress);
        const lockPeriod = 5;
        const value = 10;

        await remittanceInstance.lockFunds(accessHash, lockPeriod, {from: accounts[0], value: value});
        await remittanceInstance.claimFunds(secret, {from: carolAddress});
    });

    it('should not be able to cancel the locking operation when funds are already claimed', async () => {
        const latestBlock = await web3.eth.getBlock("latest");
        const secret = Sha3("string1", latestBlock.hash);
        const accessHash = Sha3(secret, carolAddress);
        const lockPeriod = 5;
        const value = 10;

        await remittanceInstance.lockFunds(accessHash, lockPeriod, {from: accounts[0], value: value});
        await remittanceInstance.claimFunds(secret, {from: carolAddress});
        await truffleAssert.fails(remittanceInstance.cancelFunds(accessHash, {from: accounts[0]}));
    });

});