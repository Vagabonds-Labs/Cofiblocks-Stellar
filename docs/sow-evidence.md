# SOW evidence — deliverable 2 (2026-11-17)

Contract: [`CC4ZL3I3IDG5BNBBH4XRRM2CWG6VZHJEND2SAHLCY7ISMUEWIG5TW524`](https://stellar.expert/explorer/testnet/contract/CC4ZL3I3IDG5BNBBH4XRRM2CWG6VZHJEND2SAHLCY7ISMUEWIG5TW524) on Stellar testnet.
Batch: `17-11-2026 KK-DEMO001` (farmer `KK-DEMO001`). Final state on chain: RECEIVED, 44.75 kg.

| Proof | Call | Result | Transaction |
|---|---|---|---|
| Setup | grant_role Collector → KK (GDYLNA…) | Succeeded | [15614c9471…](https://stellar.expert/explorer/testnet/tx/15614c947136065f19e6e743c3c1dd4c83fd43a2836503c95fab05ebc94c8b33) |
| Setup | grant_role Collector → DM (GBOILF…) | Succeeded | [516145bc04…](https://stellar.expert/explorer/testnet/tx/516145bc04ec9ade779f2ebad0b6d5cf20f1b8babd0256f3636c8041f328ceeb) |
| 1. Farmer creates a batch | register_farmer KK-DEMO001 | Succeeded | [096e05f947…](https://stellar.expert/explorer/testnet/tx/096e05f947c9d49caad60df56e80adaa1ca5a8eb9a2b4c50be7e0b45477e536c) |
| 1. Farmer creates a batch | record_consent (EUDR) | Succeeded | [5ba44ee7c9…](https://stellar.expert/explorer/testnet/tx/5ba44ee7c9832b7f92ece31aa63a04f38e09dac45f0e4c6a13c71ccd91de1b62) |
| 1. Farmer creates a batch | set_profile v1 | Succeeded | [dce2c8f34a…](https://stellar.expert/explorer/testnet/tx/dce2c8f34a3db8abb019baa6060639e851c2c785db379c78009938ee6ef75dfb) |
| 1. Farmer creates a batch | create_batch "17-11-2026 KK-DEMO001" | Succeeded | [5a85dc30c7…](https://stellar.expert/explorer/testnet/tx/5a85dc30c7750c0588171f425b3a0adcbebc5df52286bbe4523974712b8787c2) |
| 2. Collector adds an authorized event | record_reception "17-11-2026 KK-DEMO001": 44.75 kg + receipt hash | Succeeded | [76cb9a81f2…](https://stellar.expert/explorer/testnet/tx/76cb9a81f2cb3ac09514ee52ff338b97e90534441f38c8abce50568cbf29c7c2) |
| 3. Unauthorized attempt rejected on chain | record_reception by a DM Collector on a KK batch → Error(Contract, #4) WRONG_ORGANIZATION | Rejected by the contract | [84db734296…](https://stellar.expert/explorer/testnet/tx/84db734296bd1c393978a5c2d17c32e7486188ec14d9149d17bd48be15952921) |
| 3. Unauthorized attempt rejected on chain | record_reception a second time on "17-11-2026 KK-DEMO001" → Error(Contract, #13) RECEPTION_ALREADY_RECORDED | Rejected by the contract | [edce8cc4a3…](https://stellar.expert/explorer/testnet/tx/edce8cc4a3bdb259b2a810b2543edbd039180d93bb3efae4b9a0680502657681) |

Generated with `npm run sow:evidence` (backend). Farmer steps go through the VoiceLedger integration API signed like the VoiceLedger bot; the farmer-agent wallet signs them on chain. The Collector signs with their own wallet and the backend pays the fee (fee-bump). The rejected attempts were sent without simulation so the contract itself rejects them on chain.
