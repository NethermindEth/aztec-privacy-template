# Generic Portal (Solidity)

`GenericPortal.sol` is the L1-side skeleton for request/execute privacy flows.

The contract is intentionally protocol-neutral and only exposes one execution hook:
`IGenericActionExecutor.executeAction`.

## Responsibilities

1. register outbound request metadata (`requestAction`)
2. enforce relayer-only inbound execution (`executeAction`)
3. bind execute payload to request payload via deterministic hashes
4. send completion message to Aztec on success
5. register escape requests on failure

## Files

- `GenericPortal.sol`: generic portal implementation
- `test/GenericPortal.t.sol`: deterministic portal behavior tests

## Integration checklist

1. Keep `BasePortal` hash inputs identical across Aztec and L1.
2. Replace `IGenericActionExecutor` with protocol-specific integration contract(s).
3. Keep `onlyRelayer` on execute paths.
4. Preserve escape registration behavior on execution failure.
5. Add protocol-specific tests for request payload validation and failure semantics.
