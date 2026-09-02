import { ContractFactory } from "@/lib/CofiblocksContracts/ContractFactory"
import { logger } from "@/lib/logger"

const contractFactory = new ContractFactory()

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5000

export async function verifySignature(hash: string, signatures: string[], accountAddress: string): Promise<boolean> {
    const accountContract = contractFactory.getAccountContract(accountAddress)
    logger.info(`Verifying signature for hash ${hash}, signatures ${signatures}, accountAddress ${accountAddress}`)

    let lastError: unknown
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await accountContract.isValidSignature(hash, signatures).call()
            const isValid = (result as { isValid: bigint }).isValid
            logger.info(`Result: ${isValid}`)
            if (!isValid) {
                logger.error(`Invalid signature for hash ${hash} and account ${accountAddress}, result: ${isValid.toString()}`)
            }
            return isValid > BigInt(0)
        } catch (error) {
            lastError = error
            if (attempt < MAX_RETRIES) {
                logger.warn({ error }, `Signature verification failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${RETRY_DELAY_MS / 1000}s...`)
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
            } else {
                logger.error({ error }, `Signature verification failed after ${MAX_RETRIES + 1} attempts`)
            }
        }
    }

    throw lastError
}
