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

    it('should lock the funds in the contract', async () => {
        const value = 10;
        const password = web3.utils.soliditySha3("string1", "string2");

        await remittanceInstance.lockFunds(password, {from: accounts[0], value: value});

        const lockedValue = await remittanceInstance.balances.call(password);
        assert.strictEqual(lockedValue.toString(), value.toString(), "Locked value is not correct");
    });

    it('should lock even more funds in the contract with the same password', async () => {
        const value = 10;
        const password = web3.utils.soliditySha3("string1", "string2");

        await remittanceInstance.lockFunds(password, {from: accounts[0], value: value});
        await remittanceInstance.lockFunds(password, {from: accounts[0], value: value});

        const lockedValue = await remittanceInstance.balances.call(password);
        assert.strictEqual(lockedValue.toString(), (value * 2).toString(), "Locked value is not correct");
    });

    it('should lock two different funds in the contract', async () => {
        const value1 = 10;
        const value2 = 11;
        const password1 = web3.utils.soliditySha3("string1", "string2");
        const password2 = web3.utils.soliditySha3("string2", "string1");

        await remittanceInstance.lockFunds(password1, {from: accounts[0], value: value1});
        await remittanceInstance.lockFunds(password2, {from: accounts[0], value: value2});

        const lockedValue1 = await remittanceInstance.balances.call(password1);
        assert.strictEqual(lockedValue1.toString(), value1.toString(), "Locked value is not correct");

        const lockedValue2 = await remittanceInstance.balances.call(password2);
        assert.strictEqual(lockedValue2.toString(), value2.toString(), "Locked value is not correct");
    });

    it('claim the locked funds in the contract', async () => {
        const gasPrice = 21;
        const value = 10;
        const secret1 = "string1";
        const secret2 = "string2";

        const carolPreBalance = await web3.eth.getBalance(carolAddress);

        await remittanceInstance.lockFunds(web3.utils.soliditySha3(secret1, secret2),
            {from: accounts[0], value: value});
        const carolTxObj = await remittanceInstance.claimFunds(
            web3.utils.stringToHex(secret1),
            web3.utils.stringToHex(secret2),
            {from: carolAddress, gasPrice: gasPrice});

        const carolBalanceChange = new BN(value - carolTxObj.receipt.gasUsed * gasPrice);
        const expectedCarolBalance = new BN(carolPreBalance).add(carolBalanceChange);
        const carolBalance = await web3.eth.getBalance(carolAddress);

        assert.strictEqual(carolTxObj.receipt.status, true, "Carol TX failed");
        assert.strictEqual(carolBalance, expectedCarolBalance.toString(),
                            "Carol balance is not correct");
    });

    it('claim without locking', async () => {
        const secret1 = "string1";
        const secret2 = "string2";

        await truffleAssert.fails(remittanceInstance.claimFunds(
            web3.utils.stringToHex(secret1),
            web3.utils.stringToHex(secret2),
            {from: carolAddress}));
    });

});