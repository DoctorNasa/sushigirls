import { expect } from "chai";
import { ecsign } from "ethereumjs-util";
import { BigNumber, constants } from "ethers";
import { defaultAbiCoder, hexlify, keccak256, toUtf8Bytes } from "ethers/lib/utils";
import { waffle } from "hardhat";
import SushiGirlArtifact from "../artifacts/contracts/SushiGirl.sol/SushiGirl.json";
import TestLPTokenArtifact from "../artifacts/contracts/test/TestLPToken.sol/TestLPToken.json";
import { SushiGirl, TestLPToken } from "../typechain";
import { expandTo18Decimals } from "./shared/utils/number";
import { getERC721ApprovalDigest } from "./shared/utils/standard";

const { deployContract } = waffle;

describe("SushiGirl", () => {
    let testLPToken: TestLPToken;
    let sushiGirl: SushiGirl;

    const provider = waffle.provider;
    const [admin, other] = provider.getWallets();

    beforeEach(async () => {

        testLPToken = await deployContract(
            admin,
            TestLPTokenArtifact,
            []
        ) as TestLPToken;

        sushiGirl = await deployContract(
            admin,
            SushiGirlArtifact,
            [testLPToken.address]
        ) as SushiGirl;
    })

    context("new SushiGirl", async () => {
        it("name, symbol, DOMAIN_SEPARATOR, PERMIT_TYPEHASH", async () => {
            const name = await sushiGirl.name()
            expect(name).to.eq("Sushi Girl")
            expect(await sushiGirl.symbol()).to.eq("(◠‿◠🍣)")
            expect(await sushiGirl.DOMAIN_SEPARATOR()).to.eq(
                keccak256(
                    defaultAbiCoder.encode(
                        ["bytes32", "bytes32", "bytes32", "uint256", "address"],
                        [
                            keccak256(
                                toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
                            ),
                            keccak256(toUtf8Bytes(name)),
                            keccak256(toUtf8Bytes("1")),
                            31337,
                            sushiGirl.address
                        ]
                    )
                )
            )
            expect(await sushiGirl.PERMIT_TYPEHASH()).to.eq(
                keccak256(toUtf8Bytes("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)"))
            )
        })

        it("changeLPTokenToSushiGirlPower", async () => {
            expect(await sushiGirl.lpTokenToSushiGirlPower()).to.eq(BigNumber.from(1))
            await expect(sushiGirl.changeLPTokenToSushiGirlPower(BigNumber.from(2)))
                .to.emit(sushiGirl, "ChangeLPTokenToSushiGirlPower")
                .withArgs(BigNumber.from(2))
            expect(await sushiGirl.lpTokenToSushiGirlPower()).to.eq(BigNumber.from(2))
        })

        it("mint, powerOf", async () => {

            const id = BigNumber.from(0);
            const power = BigNumber.from(12);

            await expect(sushiGirl.mint(power))
                .to.emit(sushiGirl, "Transfer")
                .withArgs(constants.AddressZero, admin.address, id)
            expect(await sushiGirl.powerOf(id)).to.eq(power)
            expect(await sushiGirl.totalSupply()).to.eq(BigNumber.from(1))
            expect(await sushiGirl.tokenURI(id)).to.eq(`https://api.maidcoin.org/sushigirl/${id}`)
        })

        it("support, powerOf", async () => {

            const id = BigNumber.from(0);
            const power = BigNumber.from(12);
            const token = BigNumber.from(100);

            await testLPToken.mint(admin.address, token);
            await testLPToken.approve(sushiGirl.address, token);

            await expect(sushiGirl.mint(power))
                .to.emit(sushiGirl, "Transfer")
                .withArgs(constants.AddressZero, admin.address, id)
            await expect(sushiGirl.support(id, token))
                .to.emit(sushiGirl, "Support")
                .withArgs(id, token)
            expect(await sushiGirl.powerOf(id)).to.eq(power.add(token.mul(await sushiGirl.lpTokenToSushiGirlPower()).div(expandTo18Decimals(1))))
        })

        it("desupport, powerOf", async () => {

            const id = BigNumber.from(0);
            const power = BigNumber.from(12);
            const token = BigNumber.from(100);

            await testLPToken.mint(admin.address, token);
            await testLPToken.approve(sushiGirl.address, token);

            await expect(sushiGirl.mint(power))
                .to.emit(sushiGirl, "Transfer")
                .withArgs(constants.AddressZero, admin.address, id)
            await expect(sushiGirl.support(id, token))
                .to.emit(sushiGirl, "Support")
                .withArgs(id, token)
            expect(await sushiGirl.powerOf(id)).to.eq(power.add(token.mul(await sushiGirl.lpTokenToSushiGirlPower()).div(expandTo18Decimals(1))))
            await expect(sushiGirl.desupport(id, token))
                .to.emit(sushiGirl, "Desupport")
                .withArgs(id, token)
            expect(await sushiGirl.powerOf(id)).to.eq(power)
        })

        it("permit", async () => {

            const id = BigNumber.from(0);

            await expect(sushiGirl.mint(BigNumber.from(12)))
                .to.emit(sushiGirl, "Transfer")
                .withArgs(constants.AddressZero, admin.address, id)

            const nonce = await sushiGirl.nonces(id)
            const deadline = constants.MaxUint256
            const digest = await getERC721ApprovalDigest(
                sushiGirl,
                { spender: other.address, id },
                nonce,
                deadline
            )

            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(admin.privateKey.slice(2), "hex"))

            await expect(sushiGirl.permit(other.address, id, deadline, v, hexlify(r), hexlify(s)))
                .to.emit(sushiGirl, "Approval")
                .withArgs(admin.address, other.address, id)
            expect(await sushiGirl.getApproved(id)).to.eq(other.address)
            expect(await sushiGirl.nonces(id)).to.eq(BigNumber.from(1))
        })
    })
})
