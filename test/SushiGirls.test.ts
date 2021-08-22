import { expect } from "chai";
import { ecsign } from "ethereumjs-util";
import { BigNumber, constants } from "ethers";
import { defaultAbiCoder, hexlify, keccak256, toUtf8Bytes } from "ethers/lib/utils";
import { waffle } from "hardhat";
import SushiGirlsArtifact from "../artifacts/contracts/SushiGirls.sol/SushiGirls.json";
import MockSushiTokenArtifact from "../artifacts/contracts/test/MockSushiToken.sol/MockSushiToken.json";
import TestLPTokenArtifact from "../artifacts/contracts/test/TestLPToken.sol/TestLPToken.json";
import { MockSushiToken, SushiGirls, TestLPToken } from "../typechain";
import { expandTo18Decimals } from "./shared/utils/number";
import { getERC721ApprovalDigest } from "./shared/utils/standard";

const { deployContract } = waffle;

describe("SushiGirls", () => {
    let testLPToken: TestLPToken;
    let sushi: MockSushiToken;
    let sushiGirls: SushiGirls;

    const provider = waffle.provider;
    const [admin, other] = provider.getWallets();

    beforeEach(async () => {

        testLPToken = await deployContract(
            admin,
            TestLPTokenArtifact,
            []
        ) as TestLPToken;

        sushi = await deployContract(
            admin,
            MockSushiTokenArtifact,
            []
        ) as MockSushiToken;

        sushiGirls = await deployContract(
            admin,
            SushiGirlsArtifact,
            [testLPToken.address, sushi.address]
        ) as SushiGirls;
    })

    context("new SushiGirls", async () => {
        it("name, symbol, DOMAIN_SEPARATOR, PERMIT_TYPEHASH", async () => {
            const name = await sushiGirls.name()
            expect(name).to.eq("MaidCoin Sushi Girls")
            expect(await sushiGirls.symbol()).to.eq("SUSHIGIRLS")
            expect(await sushiGirls.DOMAIN_SEPARATOR()).to.eq(
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
                            sushiGirls.address
                        ]
                    )
                )
            )
            expect(await sushiGirls.PERMIT_TYPEHASH()).to.eq(
                keccak256(toUtf8Bytes("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)"))
            )
        })

        it("changeLPTokenToSushiGirlPower", async () => {
            expect(await sushiGirls.lpTokenToSushiGirlPower()).to.eq(BigNumber.from(1))
            await expect(sushiGirls.changeLPTokenToSushiGirlPower(BigNumber.from(2)))
                .to.emit(sushiGirls, "ChangeLPTokenToSushiGirlPower")
                .withArgs(BigNumber.from(2))
            expect(await sushiGirls.lpTokenToSushiGirlPower()).to.eq(BigNumber.from(2))
        })

        it("mint, powerOf", async () => {

            const id = BigNumber.from(0);
            const power = BigNumber.from(12);

            await expect(sushiGirls.mint(power))
                .to.emit(sushiGirls, "Transfer")
                .withArgs(constants.AddressZero, admin.address, id)
            expect(await sushiGirls.powerOf(id)).to.eq(power)
            expect(await sushiGirls.totalSupply()).to.eq(BigNumber.from(1))
            expect(await sushiGirls.tokenURI(id)).to.eq(`https://api.maidcoin.org/sushigirls/${id}`)
        })

        it("batch mint", async () => {

            const id1 = BigNumber.from(0);
            const id2 = BigNumber.from(1);
            const power1 = BigNumber.from(12);
            const power2 = BigNumber.from(15);

            await expect(sushiGirls.mintBatch([power1, power2], 2))
                .to.emit(sushiGirls, "Transfer")
                .withArgs(constants.AddressZero, admin.address, id1)
                .to.emit(sushiGirls, "Transfer")
                .withArgs(constants.AddressZero, admin.address, id2)

            expect(await sushiGirls.powerOf(id1)).to.eq(power1)
            expect(await sushiGirls.totalSupply()).to.eq(BigNumber.from(2))
            expect(await sushiGirls.tokenURI(id1)).to.eq(`https://api.maidcoin.org/sushigirls/${id1}`)

            expect(await sushiGirls.powerOf(id2)).to.eq(power2)
            expect(await sushiGirls.totalSupply()).to.eq(BigNumber.from(2))
            expect(await sushiGirls.tokenURI(id2)).to.eq(`https://api.maidcoin.org/sushigirls/${id2}`)
        })

        it("support, powerOf", async () => {

            const id = BigNumber.from(0);
            const power = BigNumber.from(12);
            const token = BigNumber.from(100);

            await testLPToken.mint(admin.address, token);
            await testLPToken.approve(sushiGirls.address, token);

            await expect(sushiGirls.mint(power))
                .to.emit(sushiGirls, "Transfer")
                .withArgs(constants.AddressZero, admin.address, id)
            await expect(sushiGirls.support(id, token))
                .to.emit(sushiGirls, "Support")
                .withArgs(id, token)
            expect(await sushiGirls.powerOf(id)).to.eq(power.add(token.mul(await sushiGirls.lpTokenToSushiGirlPower()).div(expandTo18Decimals(1))))
        })

        it("desupport, powerOf", async () => {

            const id = BigNumber.from(0);
            const power = BigNumber.from(12);
            const token = BigNumber.from(100);

            await testLPToken.mint(admin.address, token);
            await testLPToken.approve(sushiGirls.address, token);

            await expect(sushiGirls.mint(power))
                .to.emit(sushiGirls, "Transfer")
                .withArgs(constants.AddressZero, admin.address, id)
            await expect(sushiGirls.support(id, token))
                .to.emit(sushiGirls, "Support")
                .withArgs(id, token)
            expect(await sushiGirls.powerOf(id)).to.eq(power.add(token.mul(await sushiGirls.lpTokenToSushiGirlPower()).div(expandTo18Decimals(1))))
            await expect(sushiGirls.desupport(id, token))
                .to.emit(sushiGirls, "Desupport")
                .withArgs(id, token)
            expect(await sushiGirls.powerOf(id)).to.eq(power)
        })

        it("permit", async () => {

            const id = BigNumber.from(0);

            await expect(sushiGirls.mint(BigNumber.from(12)))
                .to.emit(sushiGirls, "Transfer")
                .withArgs(constants.AddressZero, admin.address, id)

            const nonce = await sushiGirls.nonces(id)
            const deadline = constants.MaxUint256
            const digest = await getERC721ApprovalDigest(
                sushiGirls,
                { spender: other.address, id },
                nonce,
                deadline
            )

            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), "hex"), Buffer.from(admin.privateKey.slice(2), "hex"))

            await expect(sushiGirls.permit(other.address, id, deadline, v, hexlify(r), hexlify(s)))
                .to.emit(sushiGirls, "Approval")
                .withArgs(admin.address, other.address, id)
            expect(await sushiGirls.getApproved(id)).to.eq(other.address)
            expect(await sushiGirls.nonces(id)).to.eq(BigNumber.from(1))
        })
    })
})
