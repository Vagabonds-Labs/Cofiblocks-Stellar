# Week 3 evidence — the full batch flow (2026-11-25)

Contract: [`CC4ZL3I3IDG5BNBBH4XRRM2CWG6VZHJEND2SAHLCY7ISMUEWIG5TW524`](https://stellar.expert/explorer/testnet/contract/CC4ZL3I3IDG5BNBBH4XRRM2CWG6VZHJEND2SAHLCY7ISMUEWIG5TW524) on Stellar testnet.

This week covers SOW deliverable 3 ("UI for State Tracking & Export"), with the delivery flow agreed with VoiceLedger on November 23:

1. **Delivery.** The Collector records the delivery in the web app: farmer, center, weight and time. VoiceLedger receives `delivery.proposed` and the farmer confirms it in the bot. Only then is the batch created on chain (`create_batch`, farmer-agent wallet). If the farmer rejects it, or nobody answers within 48 h, nothing goes on chain.
2. **Reception.** The Collector signs the confirmed weight and the hash of the receipt photo (`record_reception`). The backend refuses any other weight.
3. **Stages.** The Industry Manager, the Store Keeper and the Export Manager move the batch forward from the batch page (`advance_stage`). The backend checks the same rules as the contract: the role per stage, their own cooperative (any cooperative for the Export Manager), forward only, and Fermentation optional.
4. **Documents.** Any role of the cooperative, or the Export Manager, uploads a file. The file goes to a private Supabase Storage bucket and its SHA-256 goes on chain (`attach_document`).
5. **History.** The batch page shows every step: who signed it, when, the notes, the documents and a link to each transaction. "Verified on Stellar" reads the batch from the contract and compares every step, every document and the current stage. A record edited in the database shows "Does not match Stellar".
6. **CSV.** The batches as CSV, one row per batch with the date and transaction of each step. Only pseudonymous IDs.
7. **Notifications to VoiceLedger.** A signed `batch.updated` webhook is sent at every step, and the bot can read a farmer's batches with a signed `GET`.

Every staff transaction is prepared by the backend and signed by the staff member's own wallet. The backend pays the fee (fee-bump) and checks that the signed transaction is exactly the call it prepared. Each write happens exactly once: a retry returns the same transaction.

## A batch through every stage

Batch `23-11-2026 KK-DEMO001` (farmer `KK-DEMO001`, Kilole Kirkir, Kirkir center), from delivery to sale:

| Step | Signed by | Transaction |
|---|---|---|
| Delivered (`create_batch`): the farmer confirmed 45.5 kg in the bot | Farmer-agent wallet | [90acee80a3…](https://stellar.expert/explorer/testnet/tx/90acee80a33db844f5918818fd3222dd91e530e37c9faa6e00d1d037dc556190) |
| Received (`record_reception`): 45.5 kg plus the receipt hash | Collector (KK) | [7739e074dd…](https://stellar.expert/explorer/testnet/tx/7739e074dd328807c6fca366f982c94b87ac65f7a1bd7dcbfa831ab221667b09) |
| Washing | Industry Manager (KK) | [874ffa8385…](https://stellar.expert/explorer/testnet/tx/874ffa8385ab9af73056f10caea76b982d728c6f1c5347295c39db348ff92df0) |
| Drying (Fermentation skipped) | Industry Manager (KK) | [0ff77ef6b3…](https://stellar.expert/explorer/testnet/tx/0ff77ef6b3c8383f4f719b2cf95c2a9213d328a97b74189891da454907be35ae) |
| Storage | Store Keeper (KK) | [655871bfea…](https://stellar.expert/explorer/testnet/tx/655871bfea66e1e8f3c3deeb8a42678c7b21517ab6ed5ceefa930870a476c528) |
| In transport to the union | Store Keeper (KK) | [6aa61c84fa…](https://stellar.expert/explorer/testnet/tx/6aa61c84fa0fd8ba64f760160d86d20bab0d2affd8b057bfa238dac88ef051b4) |
| Prepared with exportable bag | Export Manager (union) | [b5a392b2ac…](https://stellar.expert/explorer/testnet/tx/b5a392b2ac7f44ae30f763ceb41c3e293b25e1b5271e8f6dde704fc822cd1729) |
| Sold | Export Manager (union) | [fb7bb757d5…](https://stellar.expert/explorer/testnet/tx/fb7bb757d56e20fa21bd5de734d81c56477fc03d6eb3d253efb6be35eea70f18) |
| Document attached: `washing-report.pdf` (quality) | Industry Manager (KK) | [a11923c36e…](https://stellar.expert/explorer/testnet/tx/a11923c36e91973279b8bc869eb93c2ae0106a31d91ad11cf387ec747f7be713) |
| Document attached: `sale-contract.pdf` (sale) | Export Manager (union) | [101c5b2284…](https://stellar.expert/explorer/testnet/tx/101c5b2284c08f07ada0d5dbce1ba996e891ead70b507d58c0008b9eae3317a4) |

"Verified on Stellar" for this batch: 8 steps and 2 documents match the contract.

## A batch through the web app

Batch `23-11-2026 KK-DEMO002/2`. A test Collector signed in to the web app and recorded 22.3 kg. The farmer's confirmation was simulated with a signed `delivery.confirmation`, and the batch appeared in the Collector's list without a page reload. Then a test Industry Manager opened it from "Batches waiting for you", filled in the Washing form (21.9 kg, "Lavado en canal") and uploaded a certificate.

The browser pane has no wallet, so the final signature was made with the same user's key from a script, using the same input as the form. The page then showed both steps and the document as verified.

| Step | Signed by | Transaction |
|---|---|---|
| Delivered (`create_batch`) | Farmer-agent wallet | [8d6b47d368…](https://stellar.expert/explorer/testnet/tx/8d6b47d36856f953febdfedddadb551fb90019ee2c92b30d96a8674cce3c9ad3) |
| Received: 22.3 kg | Collector (KK) | [6246b9e0ab…](https://stellar.expert/explorer/testnet/tx/6246b9e0ab327a5ba19fcc47196e1558f6ba5fd5c5fe78e94551945eec4813db) |
| Washing: 21.9 kg | Industry Manager (KK) | [8cbe60c21c…](https://stellar.expert/explorer/testnet/tx/8cbe60c21c5a7727610a816a4f66ab5de65442c9ca3d081f911b7fabd2034826) |
| Document attached: `certificado-organico.pdf` (certificate) | Industry Manager (KK) | [65c4d77657…](https://stellar.expert/explorer/testnet/tx/65c4d776573af4c40c03de97def256c2fa88a37022d438428e874094bb331fda) |

## Rules checked

Run against testnet with `npm run voiceledger:deliveries -- KK DEMO001` and `npm run batch:stages -- "23-11-2026 KK-DEMO001"`. All checks passed.

**Deliveries**

| Case | Result |
|---|---|
| The farmer confirms | The batch is created on chain. |
| The farmer rejects | Nothing goes on chain. |
| Nobody answers within 48 h | The delivery expires. |
| The Collector cancels | `delivery.proposal_closed` is sent to VoiceLedger. |
| The same answer arrives twice | Same transaction. |
| The answer is reversed | Refused with `PROPOSAL_CLOSED`. |
| The Collector signs a weight different from the confirmed one | Refused with `WEIGHT_MISMATCH`. |

**Stages**

| Case | Result |
|---|---|
| A Store Keeper tries Washing | Refused with `UNAUTHORIZED`. |
| An Industry Manager of another cooperative tries Washing | Refused with `WRONG_ORGANIZATION`. |
| Skipping Washing, repeating Washing, or anything after Sold | Refused with `INVALID_TRANSITION`. |
| The same signed transaction is sent again | Same step. |

**Documents**

| Case | Result |
|---|---|
| The same file twice | Refused with `DOCUMENT_ALREADY_ATTACHED`. |
| A document from another cooperative | Refused with `WRONG_ORGANIZATION`. |
| Download | The downloaded file matches its on-chain hash. |

**Webhooks:** every webhook reached a local fake of VoiceLedger's endpoint with a valid HMAC signature. That covers `delivery.proposed`, `delivery.proposal_closed`, and `batch.updated` for Delivered, Received and the 6 later stages.

The contract applies the same rules on its own; its unit tests and the on-chain rejections are in the [deliverable 2 evidence](sow-evidence.md).

## Not covered yet

- **Signing with a Cavos wallet in the browser:** a staff member who signs in with email (Cavos) and signs `record_reception`, `advance_stage` or `attach_document` in the web app. Every staff signature above used a Stellar keypair. The SOW video needs this path.
- **The SOW video** ("a user creates a batch and the transaction hash is shown; another user views the history, uploads a document and exports a CSV"): it needs the item above and staging.
- **Staging:** still postponed.
- **The farmers CSV for staff:** optional in the plan.
