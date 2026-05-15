import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

describe("Counter", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();

  const [adminClient, producerClient, inspectorClient, resolverClient, distributorClient] =
    await viem.getWalletClients();

  const adminAddress       = adminClient.account.address;
  const producerAddress    = producerClient.account.address;
  const inspectorAddress   = inspectorClient.account.address;
  const resolverAddress    = resolverClient.account.address;
  const distributorAddress = distributorClient.account.address;

  async function deployAndSetupRoles() {
    const counter = await viem.deployContract("Counter", [adminAddress]);

    const PRODUCER_ROLE    = await counter.read.PRODUCER_ROLE();
    const DISTRIBUTOR_ROLE = await counter.read.DISTRIBUTOR_ROLE();
    const INSPECTOR_ROLE   = await counter.read.INSPECTOR_ROLE();
    const RESOLVER_ROLE    = await counter.read.RESOLVER_ROLE();

    await counter.write.grantRole([PRODUCER_ROLE,    producerAddress],    { account: adminClient.account });
    await counter.write.grantRole([DISTRIBUTOR_ROLE, distributorAddress], { account: adminClient.account });
    await counter.write.grantRole([INSPECTOR_ROLE,   inspectorAddress],   { account: adminClient.account });
    await counter.write.grantRole([RESOLVER_ROLE,    resolverAddress],    { account: adminClient.account });

    return counter;
  }

  const META_HASH       = "0x1111111111111111111111111111111111111111111111111111111111111111" as `0x${string}`;
  const ISSUE_HASH      = "0x2222222222222222222222222222222222222222222222222222222222222222" as `0x${string}`;
  const SETTLEMENT_HASH = "0x3333333333333333333333333333333333333333333333333333333333333333" as `0x${string}`;
  const UPDATE_HASH     = "0x4444444444444444444444444444444444444444444444444444444444444444" as `0x${string}`;

  it("Should emit the BatchCreated event when calling createBatch()", async function () {
    const counter = await deployAndSetupRoles();
    const fromBlock = await publicClient.getBlockNumber();

    await counter.write.createBatch([META_HASH], { account: producerClient.account });

    const events = await publicClient.getContractEvents({
      address: counter.address,
      abi: counter.abi,
      eventName: "BatchCreated",
      fromBlock,
      strict: true,
    });

    assert.equal(events.length, 1, "Phải có đúng 1 sự kiện BatchCreated");
    assert.equal(events[0].args.metadataHash, META_HASH);
    assert.equal(events[0].args.producer?.toLowerCase(), producerAddress.toLowerCase());
  });

  it("The number of BatchCreated events should match the number of batches created", async function () {
    const counter = await deployAndSetupRoles();
    const fromBlock = await publicClient.getBlockNumber();

    const BATCH_COUNT = 5;

    for (let i = 0; i < BATCH_COUNT; i++) {
      const hash = `0x${String(i + 1).padStart(64, "1")}` as `0x${string}`;
      await counter.write.createBatch([hash], { account: producerClient.account });
    }

    const events = await publicClient.getContractEvents({
      address: counter.address,
      abi: counter.abi,
      eventName: "BatchCreated",
      fromBlock,
      strict: true,
    });

    assert.equal(BigInt(events.length), BigInt(BATCH_COUNT));

    for (let i = 0; i < BATCH_COUNT; i++) {
      assert.equal(events[i].args.batchId, BigInt(i));
    }
  });
});
