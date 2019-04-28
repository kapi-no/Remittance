const truffleAssert = require('truffle-assertions');

const Remittance = artifacts.require('Remittance');

const BN = web3.utils.BN;

contract('Remittance', (accounts) => {

    let remittanceInstance;

    let carolAddress;

    beforeEach('setup contract for each test', async function () {
        remittanceInstance = await Remittance.new({from: accounts[0]});

        carolAddress = accounts[1];
    });

    it('should compute the same hash at the client side and inside solidity', async () => {
        const secret = "string1";
        const accessHash = web3.utils.soliditySha3(secret, accounts[0]);

        const solAccessHash = await remittanceInstance.computeAccessHash(
            web3.utils.stringToHex(secret), accounts[0]);

        assert.strictEqual(solAccessHash, accessHash, "Hashes do not match");
    });

    it('should lock the funds in the contract', async () => {
        const value = 10;
        const accessHash = web3.utils.soliditySha3("string1");

        await remittanceInstance.lockFunds(accessHash, {from: accounts[0], value: value});

        const lockedValue = await remittanceInstance.balances.call(accessHash);
        assert.strictEqual(lockedValue.toString(), value.toString(), "Locked value is not correct");
    });

    it('should lock even more funds in the contract with the same accessHash', async () => {
        const value = 10;
        const accessHash = web3.utils.soliditySha3("string1");

        await remittanceInstance.lockFunds(accessHash, {from: accounts[0], value: value});
        await remittanceInstance.lockFunds(accessHash, {from: accounts[0], value: value});

        const lockedValue = await remittanceInstance.balances.call(accessHash);
        assert.strictEqual(lockedValue.toString(), (value * 2).toString(), "Locked value is not correct");
    });

    it('should lock two different funds in the contract', async () => {
        const value1 = 10;
        const value2 = 11;
        const accessHash1 = web3.utils.soliditySha3("string1");
        const accessHash2 = web3.utils.soliditySha3("string2");

        await remittanceInstance.lockFunds(accessHash1, {from: accounts[0], value: value1});
        await remittanceInstance.lockFunds(accessHash2, {from: accounts[0], value: value2});

        const lockedValue1 = await remittanceInstance.balances.call(accessHash1);
        assert.strictEqual(lockedValue1.toString(), value1.toString(), "Locked value is not correct");

        const lockedValue2 = await remittanceInstance.balances.call(accessHash2);
        assert.strictEqual(lockedValue2.toString(), value2.toString(), "Locked value is not correct");
    });

    it('claim the locked funds in the contract', async () => {
        const gasPrice = 21;
        const value = 10;
        const secret = "string1";

        const carolPreBalance = await web3.eth.getBalance(carolAddress);

        await remittanceInstance.lockFunds(web3.utils.soliditySha3(secret, carolAddress),
            {from: accounts[0], value: value});
        const carolTxObj = await remittanceInstance.claimFunds(
            web3.utils.stringToHex(secret),
            {from: carolAddress, gasPrice: gasPrice});

        const carolBalanceChange = new BN(value - carolTxObj.receipt.gasUsed * gasPrice);
        const expectedCarolBalance = new BN(carolPreBalance).add(carolBalanceChange);
        const carolBalance = await web3.eth.getBalance(carolAddress);

        assert.strictEqual(carolTxObj.receipt.status, true, "Carol TX failed");
        assert.strictEqual(carolBalance, expectedCarolBalance.toString(),
                            "Carol balance is not correct");
    });

    it('claim without locking', async () => {
        const secret = "string1";

        await truffleAssert.fails(remittanceInstance.claimFunds(
            web3.utils.stringToHex(secret),
            {from: carolAddress}));
    });

});