import {
    SIGNATURE_DOMAIN,
    SIGNATURE_TYPES,
    SIGNATURE_PRIMARY_TYPE
  } from '../types/signature'
  
  export function buildSignatureTypedData() {
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  
    return {
      domain: SIGNATURE_DOMAIN,
      types: SIGNATURE_TYPES,
      primaryType: SIGNATURE_PRIMARY_TYPE,
      message: { nonce },
    }
  }
  