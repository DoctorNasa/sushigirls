import hardhat from "hardhat";

async function main() {
    console.log("deploy start")

    const SushiGirl = await hardhat.ethers.getContractFactory("SushiGirl")
    //TODO: THIS IS FOR TEST
    const sushiGirl = await SushiGirl.deploy("0x397FF1542f962076d0BFE58eA045FfA2d347ACa0", "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2")
    console.log(`SushiGirl address: ${sushiGirl.address}`)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
