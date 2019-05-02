const Remittance = artifacts.require("Remittance");

module.exports = function(deployer) {
    const defaultMaxLockPeriod = 100*24*3600; // 100 days.

    deployer.deploy(Remittance, defaultMaxLockPeriod);
};