# PRD: aztec-protocol-privacy-template

> **Version**: 1.0
**Date**: 2026-02-16
**Status**: Draft - Pending Engineering Review
**License**: MIT
> 

---

## Context

Ethereum DeFi protocols lack a standardized, production-ready path to integrate with Aztec as a privacy layer. Today, each protocol must independently learn Aztec's architecture (Noir contracts, portal messaging, UTXO/notes model, authwit patterns) and build bespoke integrations from scratch. This creates a high barrier to entry that slows Aztec ecosystem growth and leaves DeFi users without privacy options.

**This PRD defines a comprehensive, forkable template repository** that enables any Ethereum DeFi protocol to integrate with Aztec as a "privacy VPN" for blockchain interactions. The template ships with three reference implementations (Aave, Uniswap V3, Lido) covering lending, DEX, and yield categories, plus documented patterns for extending to any protocol category.

**Distribution model**: Fork the repo, delete what you don't need, configure privacy settings, customize adapters, deploy.

---

## 1. Product Overview

### 1.1 Name

`aztec-protocol-privacy-template`

### 1.2 License

MIT

### 1.3 Target Users

- **Protocol teams** (Aave, Uniswap, Lido, etc.) wanting to add an Aztec privacy layer to their existing protocol
- **Independent developers** building privacy wrappers around existing DeFi protocols

### 1.4 Value Proposition

A developer forks this repo and has a working local privacy integration within hours, not weeks. The template handles the hard parts: Noir circuit design, portal contract messaging, privacy configuration, cross-chain flows, and error recovery.

### 1.5 Non-Goals

- Not a maintained SDK/package ecosystem (protocols own the forked code)
- No frontend/UI (contracts + TypeScript SDK only)
- No compliance code shipped (compliance-ready architecture only)
- No gas optimization implementations (documented strategies only)

---

## 2. Aztec Technical Background

### 2.1 What is Aztec?

Aztec is a **privacy-first Layer 2 zkRollup on Ethereum**. Unlike Ethereum's transparent environment, it brings privacy to smart contracts via:

- **Private execution** on user devices (PXE - Private eXecution Environment)
- **Public execution** via the Aztec Virtual Machine (AVM) on nodes
- **Encrypted UTXO model** ("notes") for private state
- **Zero-knowledge proofs** for transaction validity without revealing data

### 2.2 Key Aztec Concepts for This Template

| Concept | Description | Relevance |
| --- | --- | --- |
| **Notes (UTXOs)** | Encrypted data chunks, only decryptable by owner. Stored as commitments in a merkle tree. | Core privacy primitive - all private balances are notes |
| **Nullifiers** | Unique hashes emitted when a note is "spent". Prevents double-spending without revealing which note. | Every private withdrawal/transfer must nullify notes |
| **Portal Contracts** | L1 Solidity contracts that bridge L1<>L2 via Inbox/Outbox messaging | How our adapters talk to Aztec |
| **Inbox/Outbox** | L1 mailboxes. Inbox = L1->L2 messages (deposits). Outbox = L2->L1 messages (withdrawals). | Message passing infrastructure |
| **Authwit** | Authentication Witnesses - single-use, action-specific authorization. Replaces ERC20 `approve()`. | How users authorize DeFi operations privately |
| **Account Abstraction** | Every Aztec account is a smart contract. Custom auth, nonce management, fee payment. | Flexible user experience |
| **Fee Abstraction (FPCs)** | Fee-Paying Contracts let users pay fees in any token or have fees sponsored. | UX improvement - users don't need Aztec native token |
| **Noir / [Aztec.nr](http://aztec.nr/)** | Noir is the ZK DSL; [Aztec.nr](http://aztec.nr/) is the framework for writing Aztec contracts. | Language for all L2 contract code |
| **Aztec.js** | TypeScript SDK for interacting with Aztec contracts from frontends/backends. | Foundation for our TypeScript client layer |

### 2.3 Cross-Chain Messaging Architecture

```
L1 (Ethereum)                              L2 (Aztec)
┌─────────────────┐                        ┌─────────────────┐
│   DeFi Protocol │                        │  Noir Contract   │
│  (Aave/Uni/Lido)│                        │  (private exec)  │
└────────┬────────┘                        └────────┬────────┘
         │                                          │
┌────────▼────────┐                        ┌────────▼────────┐
│  Thin Wrapper   │                        │  L2 Message      │
│  (our adapter)  │                        │  Handler         │
└────────┬────────┘                        └────────┬────────┘
         │                                          │
┌────────▼────────┐    ┌──────────┐       ┌────────▼────────┐
│  Portal Contract│◄───│  Aztec   │──────►│  Portal (L2 side)│
│  (Inbox/Outbox) │    │  Rollup  │       │                  │
└─────────────────┘    └──────────┘       └──────────────────┘
```

**L1 -> L2 (Deposit) Flow:**

1. User calls Portal on L1 with deposit params
2. Portal interacts with DeFi protocol (e.g., `aave.deposit()`)
3. Portal sends message to Aztec Inbox
4. Sequencer includes message in next block
5. Noir contract on L2 creates private note for user

**L2 -> L1 (Withdrawal) Flow:**

1. User's Noir contract nullifies private note
2. Emits L2->L1 message to Outbox
3. Relayer (or user) calls Portal on L1
4. Portal consumes Outbox message
5. Portal calls DeFi protocol (e.g., `aave.withdraw()`)
6. Funds sent to user/relayer

---

## 3. Architecture

### 3.1 High-Level Flow

```
User (L2 Aztec)
  └─> Noir Privacy Contract (L2, private execution on user device)
       └─> L2->L1 Message (via Aztec Outbox)
            └─> L1 Portal Contract (consumes message)
                 └─> L1 Thin Wrapper Adapter
                      └─> Target Protocol (Aave/Uniswap/Lido)
                           └─> L1->L2 Message (via Aztec Inbox)
                                └─> Noir Contract (mints private notes to user)
```

### 3.2 Aztec Version Strategy

**Version-agnostic design** with an abstraction layer:

- All Aztec SDK interactions go through an `AztecProvider` abstraction
- Provider implementations for testnet, mainnet (Ignition Chain), and local sandbox
- Breaking changes in Aztec SDK require updating only the provider layer, not protocol logic

### 3.3 Privacy Model: Configurable (Compile-Time)

Privacy parameters are set in a `privacy.toml` config file before compiling Noir circuits. Different circuit variants are generated based on configuration.

```toml
# privacy.toml - Example configuration
[protocol]
name = "aave-privacy"
type = "lending"

[privacy.amounts]
private = true          # Hide deposit/withdrawal amounts

[privacy.participants]
private = true          # Hide sender/receiver addresses

[privacy.action_type]
private = false         # Whether the action type (deposit, borrow, etc.) is hidden

[privacy.asset]
private = true          # Hide which token is being used

[compliance]
viewing_keys = true     # Enable viewing key infrastructure for optional disclosure
audit_hooks = false     # Enable audit trail hooks (protocol implements logic)
```

A build script reads `privacy.toml` and generates the appropriate Noir circuit variants with conditional compilation.

### 3.4 L1 Adapter Pattern: Thin Wrapper + Portal

Each protocol integration consists of two L1 Solidity contracts:

1. **Thin Wrapper** - Minimal contract wrapping the target protocol's interface (e.g., calls `aaveLendingPool.deposit()`)
2. **Portal Contract** - Handles L1<>L2 message passing via Aztec's Inbox/Outbox, connected to the wrapper

### 3.5 L1 Transaction Execution: Configurable

Two modes, configurable per deployment:

| Mode | Privacy | Complexity | Use Case |
| --- | --- | --- | --- |
| **Relayer** (default) | Maximum - no L1 address linkage | Higher - needs relayer infrastructure | Production deployments |
| **Self-execution** (fallback) | Reduced - L1<>L2 address linkable | Lower - user handles L1 tx directly | Development, testing |

Privacy tradeoffs documented in `/docs/PRIVACY_TRADEOFFS.md`.

### 3.6 Error Recovery: Timeout + Escape Hatch

- If L2 minting fails after L1 deposit succeeds, a timeout-based escape hatch refunds on L1 after N blocks
- Configurable timeout period per protocol adapter
- Simple, auditable recovery path without complex retry logic

```
Deposit on L1 ──> L1->L2 Message Sent ──> L2 Minting Fails?
                                              │
                            ┌─────────────────┤
                            │ YES             │ NO
                            ▼                 ▼
                   Wait N blocks         Note created
                            │             (success)
                            ▼
                   Call escapeHatch()
                            │
                            ▼
                   Funds refunded on L1
```

### 3.7 Compliance-Ready Architecture

No compliance code shipped, but the architecture supports:

- **Viewing key infrastructure** - Aztec's incoming/outgoing viewing keys enabled via `privacy.toml`
- **Optional disclosure hooks** - Interface stubs where protocols can add deposit screening, withdrawal limits, or audit trails
- **Documented compliance patterns** in `/docs/COMPLIANCE_ARCHITECTURE.md`

---

## 4. Repository Structure

```
aztec-protocol-privacy-template/
├── README.md                           # Overview, quick start, architecture diagram
├── privacy.toml                        # Default privacy configuration template
├── LICENSE                             # MIT
│
├── shared/                             # Shared utilities across all protocols
│   ├── noir/                           # Shared Noir libraries
│   │   ├── privacy_config/             # Privacy config parser (reads privacy.toml)
│   │   ├── aztec_provider/             # Version-agnostic Aztec SDK abstraction
│   │   ├── notes/                      # Common note types (ValueNote, TokenNote, etc.)
│   │   ├── authwit/                    # Authentication witness helpers
│   │   └── messaging/                  # L1<>L2 message utilities
│   ├── solidity/                       # Shared Solidity contracts
│   │   ├── BasePortal.sol              # Base portal contract (Inbox/Outbox integration)
│   │   ├── BaseAdapter.sol             # Base thin wrapper adapter
│   │   ├── EscapeHatch.sol             # Timeout-based escape hatch module
│   │   └── interfaces/                 # Common interfaces (IPortal, IAdapter, IRelayer)
│   ├── typescript/                     # Shared TypeScript utilities
│   │   ├── aztec-provider.ts           # AztecProvider abstraction (sandbox/testnet/mainnet)
│   │   ├── privacy-config.ts           # Privacy config reader/validator
│   │   ├── message-utils.ts            # Cross-chain message helpers
│   │   ├── note-utils.ts              # Note encryption/decryption helpers
│   │   └── relayer.ts                  # Relayer client (submit L1 txs for L2 users)
│   └── scripts/
│       ├── build-circuits.sh           # Reads privacy.toml, compiles Noir circuits
│       └── setup-sandbox.sh            # Local Aztec sandbox setup
│
├── aave/                               # REFERENCE: Lending/Borrowing (self-contained)
│   ├── README.md                       # Aave-specific guide
│   ├── privacy.toml                    # Aave privacy config
│   ├── noir/                           # Noir contracts (L2 Aztec)
│   │   ├── Nargo.toml
│   │   └── src/
│   │       ├── main.nr                 # Aave privacy contract entry point
│   │       ├── deposit.nr              # Private deposit logic
│   │       ├── withdraw.nr             # Private withdrawal logic
│   │       ├── borrow.nr               # Private borrow logic
│   │       ├── repay.nr                # Private repay logic
│   │       └── types.nr                # Aave-specific note types
│   ├── solidity/                       # L1 Solidity contracts
│   │   ├── AavePortal.sol              # Portal: L1<>L2 messaging for Aave
│   │   ├── AaveAdapter.sol             # Thin wrapper around Aave LendingPool
│   │   └── test/
│   │       └── AaveAdapter.t.sol       # Foundry tests (mainnet fork)
│   ├── typescript/                     # TypeScript integration
│   │   ├── aave-client.ts              # Aave privacy client
│   │   └── aave-client.test.ts         # Integration tests
│   └── hardhat.config.ts               # Hardhat config (mainnet fork)
│
├── uniswap/                            # REFERENCE: DEX/Swaps (self-contained)
│   ├── README.md
│   ├── privacy.toml
│   ├── noir/
│   │   ├── Nargo.toml
│   │   └── src/
│   │       ├── main.nr                 # Uniswap privacy contract
│   │       ├── swap.nr                 # Private swap logic (L2->L1->L2)
│   │       ├── add_liquidity.nr        # Private LP provision
│   │       └── types.nr                # Swap-specific note types
│   ├── solidity/
│   │   ├── UniswapPortal.sol           # Portal: L1<>L2 messaging for Uniswap
│   │   ├── UniswapAdapter.sol          # Thin wrapper around Uniswap Router
│   │   └── test/
│   │       └── UniswapAdapter.t.sol
│   ├── typescript/
│   │   ├── uniswap-client.ts           # Uniswap privacy client
│   │   └── uniswap-client.test.ts
│   └── hardhat.config.ts
│
├── lido/                               # REFERENCE: Staking/Yield (self-contained)
│   ├── README.md
│   ├── privacy.toml
│   ├── noir/
│   │   ├── Nargo.toml
│   │   └── src/
│   │       ├── main.nr                 # Lido privacy contract
│   │       ├── stake.nr                # Private staking logic
│   │       ├── unstake.nr              # Private unstaking logic
│   │       └── types.nr                # Staking-specific note types
│   ├── solidity/
│   │   ├── LidoPortal.sol
│   │   ├── LidoAdapter.sol             # Thin wrapper around Lido stETH
│   │   └── test/
│   │       └── LidoAdapter.t.sol
│   ├── typescript/
│   │   ├── lido-client.ts
│   │   └── lido-client.test.ts
│   └── hardhat.config.ts
│
├── docs/                               # Comprehensive in-repo markdown documentation
│   ├── ARCHITECTURE.md                 # System architecture, data flow diagrams
│   ├── GETTING_STARTED.md              # Fork -> Configure -> Build -> Test -> Deploy
│   ├── PRIVACY_CONFIGURATION.md        # privacy.toml reference, all options
│   ├── ADDING_NEW_PROTOCOL.md          # Step-by-step guide to add a new protocol
│   ├── CROSS_CHAIN_MESSAGING.md        # Portal contracts, Inbox/Outbox, message lifecycle
│   ├── PRIVACY_TRADEOFFS.md            # Relayer vs self-execution, metadata analysis
│   ├── COMPLIANCE_ARCHITECTURE.md      # Viewing keys, disclosure hooks, audit patterns
│   ├── SECURITY_GUIDE.md              # Threat model, common vulnerabilities, mitigations
│   ├── AUDIT_CHECKLIST.md             # Pre-audit checklist for production readiness
│   ├── OPTIMIZATION_STRATEGIES.md      # Gas optimization patterns (documented only)
│   ├── DEPLOYMENT_GUIDE.md            # Testnet and mainnet deployment playbook
│   ├── AZTEC_PRIMER.md               # Aztec concepts for Ethereum developers
│   └── FAQ.md                         # Common questions and troubleshooting
│
├── tests/                              # Cross-protocol integration tests
│   ├── jest.config.ts
│   ├── sandbox-setup.ts               # Aztec sandbox test harness
│   └── e2e/
│       ├── aave-e2e.test.ts
│       ├── uniswap-e2e.test.ts
│       └── lido-e2e.test.ts
│
└── scripts/
    ├── setup.sh                        # One-command project setup
    ├── build-all.sh                    # Build all protocols
    ├── test-all.sh                     # Run all tests
    └── fork-setup.sh                   # Post-fork cleanup (remove unused protocols)
```

---

## 5. Reference Implementations

### 5.1 Aave (Lending/Borrowing)

**Private Operations:**

| Operation | L2 (Aztec) | L1 (Ethereum) | Privacy |
| --- | --- | --- | --- |
| Deposit | User creates shielded deposit note | Portal calls `aave.deposit()` | Amount + depositor hidden |
| Withdraw | User nullifies deposit note, creates L2->L1 message | Portal calls `aave.withdraw()`, sends to user/relayer | Amount + recipient hidden |
| Borrow | User creates borrow note against shielded collateral | Portal calls `aave.borrow()` | Borrow amount + borrower hidden |
| Repay | User nullifies borrow note | Portal calls `aave.repay()` | Repay amount + payer hidden |

**Key Design Decisions:**

- Collateral health factor tracked via periodic L1 state sync to L2 (public state on Aztec)
- Interest accrual calculated on L1 at withdrawal time (avoids complex private state updates)
- Liquidation protection: private positions have a public "health signal" (above/below threshold, no exact values)

**Noir Contract Structure:**

```
aave/noir/src/
├── main.nr          # Contract entry: registers functions, defines storage
├── deposit.nr       # #[private] fn deposit(token, amount, secret_hash)
│                    #   -> Creates ValueNote, sends L2->L1 deposit message
├── withdraw.nr      # #[private] fn withdraw(token, amount, recipient)
│                    #   -> Nullifies note, sends L2->L1 withdrawal message
├── borrow.nr        # #[private] fn borrow(token, amount, collateral_note)
│                    #   -> Verifies collateral, creates borrow note + L2->L1 message
├── repay.nr         # #[private] fn repay(token, amount, borrow_note)
│                    #   -> Nullifies borrow note, sends L2->L1 repay message
└── types.nr         # DepositNote, BorrowNote, CollateralNote definitions
```

**Solidity Contract Structure:**

```solidity
// AaveAdapter.sol - Thin wrapper
contract AaveAdapter is BaseAdapter {
    ILendingPool public immutable aaveLendingPool;

    function deposit(address token, uint256 amount) external onlyPortal {
        IERC20(token).approve(address(aaveLendingPool), amount);
        aaveLendingPool.deposit(token, amount, address(this), 0);
    }

    function withdraw(address token, uint256 amount, address to) external onlyPortal {
        aaveLendingPool.withdraw(token, amount, to);
    }
    // ... borrow, repay
}

// AavePortal.sol - L1<>L2 messaging
contract AavePortal is BasePortal {
    AaveAdapter public immutable adapter;

    function depositAndBridge(address token, uint256 amount, bytes32 secretHash) external {
        adapter.deposit(token, amount);
        _sendL1ToL2Message(/* mint note on L2 */);
    }

    function withdrawFromL2(/* outbox message params */) external {
        _consumeL2ToL1Message(/* validate message */);
        adapter.withdraw(token, amount, recipient);
    }
    // ... escape hatch via EscapeHatch.sol
}
```

### 5.2 Uniswap V3 (DEX/Swaps)

**Private Operations:**

| Operation | L2 (Aztec) | L1 (Ethereum) | Privacy |
| --- | --- | --- | --- |
| Swap | User creates swap request note on L2 | Portal calls `router.exactInputSingle()` | Swap amounts + trader hidden |
| Add Liquidity | User creates LP note on L2 | Portal calls `positionManager.mint()` | LP amounts + provider hidden |
| Remove Liquidity | User nullifies LP note | Portal calls `positionManager.decreaseLiquidity()` | Amounts + provider hidden |

**Key Design Decisions:**

- Slippage tolerance set by user in private L2 transaction (included in L2->L1 message)
- MEV protection: relayer cannot modify swap params (locked in L2 message hash)
- Any third party can execute the L1 swap (privacy-preserving relayer pattern from Aztec docs)
- LP position NFT held by adapter contract, mapped to user's private notes on L2

**Noir Contract Structure:**

```
uniswap/noir/src/
├── main.nr          # Contract entry point
├── swap.nr          # #[private] fn swap_private(input_token, output_token, amount, min_output, secret_hash)
│                    #   -> Nullifies input note, sends L2->L1 swap message
│                    #   -> On completion: L1->L2 message mints output note
├── add_liquidity.nr # #[private] fn add_liquidity(token0, token1, amount0, amount1, ...)
│                    #   -> Creates LP position note
└── types.nr         # SwapNote, LPPositionNote definitions
```

### 5.3 Lido (Staking/Yield)

**Private Operations:**

| Operation | L2 (Aztec) | L1 (Ethereum) | Privacy |
| --- | --- | --- | --- |
| Stake ETH | User creates stake note on L2 | Portal calls `lido.submit{value}()` | Stake amount + staker hidden |
| Unstake | User nullifies stake note | Portal initiates withdrawal request | Unstake amount + requester hidden |
| Claim yields | Periodic yield note minting on L2 | Portal reads stETH balance changes | Yield amount hidden |

**Key Design Decisions:**

- stETH rebasing handled by tracking shares (not token amounts) in private notes
- Withdrawal queue: user gets a "pending withdrawal note" that becomes claimable after Lido processes it
- Yield accrual: a periodic "harvester" reads L1 stETH balance delta and mints yield notes on L2

**Noir Contract Structure:**

```
lido/noir/src/
├── main.nr          # Contract entry point
├── stake.nr         # #[private] fn stake(amount, secret_hash)
│                    #   -> Creates StakeNote (in shares, not ETH)
├── unstake.nr       # #[private] fn unstake(stake_note, amount)
│                    #   -> Nullifies stake note, creates PendingWithdrawalNote
└── types.nr         # StakeNote (shares-based), PendingWithdrawalNote, YieldNote
```

---

## 6. Shared Components Detail

### 6.1 AztecProvider Abstraction (`shared/typescript/aztec-provider.ts`)

```tsx
interface AztecProvider {
  // Connection
  connect(config: NetworkConfig): Promise<void>;
  disconnect(): Promise<void>;
  getNetwork(): NetworkInfo;

  // Contract deployment
  deployContract(artifact: ContractArtifact, args: any[]): Promise<ContractAddress>;

  // Transaction execution
  sendPrivateTx(call: PrivateCall): Promise<TxReceipt>;
  sendPublicTx(call: PublicCall): Promise<TxReceipt>;

  // Note management
  getNote(noteHash: Fr): Promise<Note>;
  getNotes(filter: NoteFilter): Promise<Note[]>;

  // Authorization
  createAuthWit(action: AuthAction): Promise<AuthWitness>;

  // Cross-chain messaging
  consumeL1Message(message: L1Message): Promise<void>;
  sendL2ToL1Message(content: Fr, recipient: EthAddress): Promise<void>;

  // Account management
  getAccount(): Promise<AccountWallet>;
  createAccount(type: AccountType): Promise<AccountWallet>;
}

// Implementations
class SandboxProvider implements AztecProvider { /* local dev */ }
class TestnetProvider implements AztecProvider { /* Aztec testnet */ }
class MainnetProvider implements AztecProvider { /* Aztec Ignition */ }
```

### 6.2 BasePortal.sol (`shared/solidity/BasePortal.sol`)

```solidity
abstract contract BasePortal {
    IRegistry public immutable registry;
    bytes32 public immutable l2Contract;  // L2 Aztec contract address

    // Send message from L1 to L2 (e.g., after deposit)
    function _sendL1ToL2Message(
        bytes32 content,
        bytes32 secretHash,
        uint64 deadline
    ) internal returns (bytes32 messageHash);

    // Consume message from L2 to L1 (e.g., withdrawal request)
    function _consumeL2ToL1Message(
        bytes32 content,
        address sender
    ) internal;

    // Relayer authentication (if relayer mode)
    modifier onlyRelayerOrSelf();

    // Version compatibility check
    function _getInbox() internal view returns (IInbox);
    function _getOutbox() internal view returns (IOutbox);
}
```

### 6.3 EscapeHatch.sol (`shared/solidity/EscapeHatch.sol`)

```solidity
abstract contract EscapeHatch {
    uint256 public immutable escapeTimeout;  // blocks until escape available

    mapping(bytes32 => EscapeRequest) public pendingEscapes;

    struct EscapeRequest {
        address depositor;
        address token;
        uint256 amount;
        uint256 depositBlock;
        bool claimed;
    }

    // Record deposit for potential escape
    function _registerEscape(bytes32 messageHash, address depositor, address token, uint256 amount) internal;

    // Claim escape after timeout (L2 side never completed)
    function claimEscape(bytes32 messageHash) external;

    // Cancel escape (L2 side completed successfully)
    function _cancelEscape(bytes32 messageHash) internal;
}
```

### 6.4 Privacy Config System

**Build script** (`shared/scripts/build-circuits.sh`):

1. Reads `privacy.toml` from protocol directory
2. Parses TOML into Noir-compatible compilation flags
3. Generates `privacy_flags.nr` with conditional compilation constants:
    
    ```
    // Auto-generated from privacy.toml - DO NOT EDIT
    global PRIVATE_AMOUNTS: bool = true;
    global PRIVATE_PARTICIPANTS: bool = true;
    global PRIVATE_ACTION_TYPE: bool = false;
    global PRIVATE_ASSET: bool = true;
    global ENABLE_VIEWING_KEYS: bool = true;
    global ENABLE_AUDIT_HOOKS: bool = false;
    ```
    
4. Compiles Noir circuits with `nargo compile`
5. Outputs circuit artifacts to `target/` directory

---

## 7. Documentation Plan

### 7.1 Core Docs (in `/docs/`)

| Document | Purpose | Target Audience |
| --- | --- | --- |
| `ARCHITECTURE.md` | System architecture, data flow, component relationships, ASCII diagrams | All developers |
| `GETTING_STARTED.md` | Fork -> Configure -> Build -> Test (step-by-step walkthrough) | New developers |
| `PRIVACY_CONFIGURATION.md` | Full `privacy.toml` reference with all options and examples | Integration developers |
| `ADDING_NEW_PROTOCOL.md` | Step-by-step guide to add a 4th, 5th, Nth protocol integration | Protocol teams |
| `CROSS_CHAIN_MESSAGING.md` | Portal contracts, Inbox/Outbox, message lifecycle, hash construction | Smart contract devs |
| `PRIVACY_TRADEOFFS.md` | Relayer vs self-execution, metadata leakage, timing analysis | Security engineers |
| `COMPLIANCE_ARCHITECTURE.md` | Viewing keys, disclosure hooks, regulatory consideration patterns | Compliance teams |
| `SECURITY_GUIDE.md` | Full threat model, attack vectors, mitigations (see Section 9) | Security auditors |
| `AUDIT_CHECKLIST.md` | 50+ item pre-production audit checklist (see Section 9) | Security auditors |
| `OPTIMIZATION_STRATEGIES.md` | Gas optimization, proof batching, note packing strategies | Performance engineers |
| `DEPLOYMENT_GUIDE.md` | Testnet and mainnet deployment playbook (manual, not scripted) | DevOps / deployment |
| `AZTEC_PRIMER.md` | Aztec concepts translated for Ethereum devs (notes, nullifiers, PXE) | Ethereum developers |
| `FAQ.md` | Common questions, troubleshooting, known gotchas | All developers |

### 7.2 Per-Protocol Docs (in `/{protocol}/README.md`)

Each protocol directory includes a README with:

- Protocol-specific architecture diagram
- Supported operations with privacy details
- Privacy configuration explanation
- Local testing walkthrough (step-by-step)
- Known limitations and future work

### 7.3 `ADDING_NEW_PROTOCOL.md` Structure

```
1. Choose your protocol category (lending, DEX, yield, other)
2. Copy the closest reference implementation directory
3. Define your privacy.toml configuration
4. Implement Noir contracts:
   a. Define note types in types.nr
   b. Implement private functions (deposit, withdraw, etc.)
   c. Add L2->L1 message construction
5. Implement Solidity contracts:
   a. Extend BaseAdapter.sol with protocol-specific calls
   b. Extend BasePortal.sol with message handling
   c. Configure EscapeHatch timeout
6. Implement TypeScript client:
   a. Extend AztecProvider for your operations
   b. Add authwit creation helpers
7. Write tests:
   a. Noir unit tests
   b. Solidity Foundry tests (mainnet fork)
   c. TypeScript integration tests
8. Update documentation
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

| Layer | Framework | What's Tested | Location |
| --- | --- | --- | --- |
| Noir circuits | Noir test framework | Each circuit function independently (deposit, withdraw, swap, etc.) | `{protocol}/noir/src/*.test.nr` |
| Solidity contracts | Foundry | Contract logic against Hardhat mainnet fork (real protocol state) | `{protocol}/solidity/test/*.t.sol` |
| TypeScript client | Jest | Client libraries with mocked AztecProvider | `{protocol}/typescript/*.test.ts` |

### 8.2 Integration Tests

| Test | Description | Location |
| --- | --- | --- |
| Cross-chain flow | Full L1<>L2 message passing against local Aztec sandbox | `tests/e2e/{protocol}-e2e.test.ts` |
| Per-protocol E2E | Complete privacy flow: deposit -> interact -> withdraw | `tests/e2e/{protocol}-e2e.test.ts` |
| Error recovery | Timeout escape hatch, failed message handling | `tests/e2e/{protocol}-e2e.test.ts` |

### 8.3 Test Infrastructure

- **L1**: Hardhat mainnet fork (real Aave/Uniswap/Lido contract state)
- **L2**: Local Aztec sandbox for private execution
- **Runner**: Jest with sandbox setup/teardown helpers (`tests/sandbox-setup.ts`)
- **Fixtures**: Pre-funded accounts, deployed contracts, pre-configured privacy.toml

### 8.4 Testing Commands

```bash
# Run all tests
./scripts/test-all.sh

# Run per-protocol
cd aave && npx hardhat test              # Solidity tests (mainnet fork)
cd aave/noir && nargo test               # Noir circuit tests
cd aave && npx jest                      # TypeScript tests

# Run E2E (requires sandbox)
./shared/scripts/setup-sandbox.sh
npx jest tests/e2e/
```

---

## 9. Security

### 9.1 Threat Model (documented in `docs/SECURITY_GUIDE.md`)

| Threat | Description | Mitigation |
| --- | --- | --- |
| **Note grinding** | Adversary brute-forces note contents | Use strong randomness in note commitments; document minimum entropy requirements |
| **Timing analysis** | Transaction timing correlation between L1 and L2 events | Relayer mode with random delay; document timing risks in self-execution mode |
| **Relayer collusion** | Relayer front-runs or censors L1 executions | Swap params locked in L2 message hash; relayer can't modify; multiple relayers |
| **Portal exploits** | Malicious message injection, replay attacks | Message hash validation, nullifier-based replay prevention, version checks |
| **State desync** | L1 state changes not reflected in L2 private notes | Periodic state sync mechanism; escape hatch for stuck funds |
| **Compliance bypass** | Users circumventing viewing key disclosure | Architecture supports enforcement but doesn't implement it (protocol responsibility) |
| **Front-running** | MEV bots exploiting public L1 execution | Private execution on L2; relayer pattern; slippage protection in message hash |
| **Key compromise** | User's nullifier/viewing keys compromised | Document key rotation patterns; account abstraction allows key migration |

### 9.2 Pre-Audit Checklist (documented in `docs/AUDIT_CHECKLIST.md`)

**Noir Circuits (15+ items):**

- [ ]  Nullifier uniqueness (no two notes produce same nullifier)
- [ ]  Note commitment integrity (commitment matches note contents)
- [ ]  No information leakage in public outputs
- [ ]  Correct constraint counts (no under-constrained circuits)
- [ ]  Private function cannot read/modify other users' notes
- [ ]  Authwit validation in all authorized operations
- [ ]  Proper secret hash handling for deposits
- [ ]  Note encryption uses correct viewing keys
- [ ]  ...

**Solidity Contracts (15+ items):**

- [ ]  Message hash collision resistance
- [ ]  Reentrancy protection on all external calls
- [ ]  Escape hatch cannot be used if L2 minting succeeded
- [ ]  Portal correctly validates Inbox/Outbox messages
- [ ]  Adapter approval handling (no leftover approvals)
- [ ]  Registry version checks prevent cross-version attacks
- [ ]  Relayer authentication (if relayer mode)
- [ ]  ...

**Cross-Chain Messaging (10+ items):**

- [ ]  L1->L2 message replay prevention
- [ ]  L2->L1 message replay prevention (Outbox consumption)
- [ ]  Message ordering assumptions documented
- [ ]  Timeout values are safe (not too short, not too long)
- [ ]  Escape hatch funds sent to correct depositor
- [ ]  ...

**Privacy Leakage (10+ items):**

- [ ]  No metadata correlation between L1 and L2 transactions
- [ ]  Timing analysis resistance (if relayer mode)
- [ ]  Amount correlation resistance (note values don't leak)
- [ ]  Action type visibility matches privacy.toml config
- [ ]  Viewing key access properly restricted
- [ ]  ...

---

## 10. Non-Functional Requirements

| Requirement | Target |
| --- | --- |
| Proof generation time | < 30 seconds per operation |
| Languages | TypeScript, Noir ([Aztec.nr](http://aztec.nr/)), Solidity |
| License | MIT |
| Node.js version | >= 18 |
| Solidity version | 0.8.20+ |
| Noir version | Compatible with latest [Aztec.nr](http://aztec.nr/) |
| Local setup time | < 15 minutes from fork to running tests |
| Test coverage | > 80% across all components |
| Documentation | Every public function documented, every flow diagrammed |

---

## 11. Implementation Phases

### Phase 1: Foundation (Shared Infrastructure)

**Goal**: Establish the repo structure, shared contracts, and tooling.

1. Create repo with per-protocol directory structure
2. Implement shared Solidity contracts:
    - `BasePortal.sol` with Inbox/Outbox integration
    - `BaseAdapter.sol` with standard interface
    - `EscapeHatch.sol` timeout recovery
    - `interfaces/` (IPortal, IAdapter, IRelayer)
3. Implement shared TypeScript:
    - `AztecProvider` abstraction (sandbox/testnet/mainnet)
    - `privacy-config.ts` TOML reader/validator
    - `message-utils.ts` and `note-utils.ts`
    - `relayer.ts` client
4. Implement privacy config build system:
    - `build-circuits.sh` (TOML -> Noir compilation flags)
    - Default `privacy.toml` template
5. Implement shared Noir libraries:
    - Common note types
    - Authwit helpers
    - Messaging utilities
6. Write core docs: `ARCHITECTURE.md`, `GETTING_STARTED.md`, `AZTEC_PRIMER.md`
7. Set up test infrastructure (Hardhat fork + Aztec sandbox harness)

### Phase 2: Aave Reference Implementation

**Goal**: Deliver the first complete, working privacy integration.

1. Implement Noir contracts: deposit, withdraw, borrow, repay circuits
2. Implement Solidity: `AavePortal.sol`, `AaveAdapter.sol`
3. Implement TypeScript: `aave-client.ts` with full privacy operations
4. Write unit tests (Noir + Solidity + TypeScript)
5. Write E2E test (`aave-e2e.test.ts`)
6. Write `aave/README.md`

### Phase 3: Uniswap Reference Implementation

**Goal**: Prove the template works for a fundamentally different protocol category (DEX).

1. Implement Noir contracts: swap, add/remove liquidity circuits
2. Implement Solidity: `UniswapPortal.sol`, `UniswapAdapter.sol`
3. Implement TypeScript: `uniswap-client.ts`
4. Write tests (unit + E2E)
5. Write `uniswap/README.md`

### Phase 4: Lido Reference Implementation

**Goal**: Cover the yield/staking category, validate the pattern for rebasing tokens.

1. Implement Noir contracts: stake, unstake, yield claim circuits
2. Implement Solidity: `LidoPortal.sol`, `LidoAdapter.sol`
3. Implement TypeScript: `lido-client.ts`
4. Write tests (unit + E2E)
5. Write `lido/README.md`

### Phase 5: Documentation & Polish

**Goal**: Make the template production-ready for forking.

1. Complete all `/docs/` documentation (13 documents)
2. Write security guide + audit checklist
3. Write `ADDING_NEW_PROTOCOL.md` step-by-step guide
4. Create `fork-setup.sh` post-fork cleanup script
5. Final README with architecture diagrams
6. Cross-protocol E2E testing
7. Internal review and documentation polish

---

## 12. Verification Plan

### How to validate the complete template:

1. **Fork and setup test**:
    
    ```bash
    git clone <repo> && cd aztec-protocol-privacy-template
    ./scripts/setup.sh
    # VERIFY: All dependencies install, no errors
    ```
    
2. **Build circuits test**:
    
    ```bash
    ./scripts/build-all.sh
    # VERIFY: Noir circuits compile with privacy.toml config for all 3 protocols
    ```
    
3. **Run all tests**:
    
    ```bash
    ./scripts/test-all.sh
    # VERIFY: All Noir, Solidity, and TypeScript tests pass
    # VERIFY: > 80% coverage
    ```
    
4. **Per-protocol E2E** (for each of Aave, Uniswap, Lido):
    
    ```bash
    ./shared/scripts/setup-sandbox.sh  # Start Aztec sandbox + Hardhat fork
    npx jest tests/e2e/aave-e2e.test.ts
    # VERIFY: Full privacy flow works: shield -> interact -> unshield
    # VERIFY: Private notes created, nullifiers emitted
    # VERIFY: L1 protocol state changed correctly
    ```
    
5. **Error recovery test**:
    
    ```bash
    # Simulate failed L2 minting
    # VERIFY: Escape hatch refund works on L1 after timeout blocks
    ```
    
6. **New protocol test** (the real validation):
    
    ```bash
    # Follow docs/ADDING_NEW_PROTOCOL.md to add a 4th protocol (e.g., Compound)
    # VERIFY: A developer can add a new protocol in < 4 hours using the guide
    # VERIFY: The new protocol's tests pass
    ```
    
7. **Fork cleanup test**:
    
    ```bash
    ./scripts/fork-setup.sh --keep aave --remove uniswap lido
    # VERIFY: Unused protocols removed cleanly, remaining protocol still works
    ```
    

---

## 13. Open Questions / Future Work

| Item | Description | Priority |
| --- | --- | --- |
| **Aztec SDK stability** | Real Aztec.js packages may have breaking changes; abstraction layer mitigates this | Monitor |
| **Proof aggregation** | Multiple private operations batched into single proof | Future optimization |
| **Multi-chain L1s** | Extending beyond Ethereum L1 to Arbitrum, Optimism, Base | Future scope |
| **Governance privacy** | Private voting patterns for protocols with governance tokens | Future feature |
| **Cross-protocol composability** | Private flash loans, private leverage (Aave + Uniswap composed privately) | Future feature |
| **Relayer incentive design** | Economic model for relayers to execute L1 transactions | Needs design |
| **Privacy set size** | Anonymity depends on the number of users in the privacy set | Document tradeoffs |

---

## Appendix A: Glossary

| Term | Definition |
| --- | --- |
| **Note** | Encrypted UTXO in Aztec's private state model |
| **Nullifier** | Hash emitted when a note is spent, prevents double-spending |
| **Portal** | L1 contract that bridges messages between Ethereum and Aztec |
| **PXE** | Private eXecution Environment - runs on user's device |
| **AVM** | Aztec Virtual Machine - runs public functions on nodes |
| **Authwit** | Authentication Witness - single-use authorization for actions |
| **Mana** | Aztec's equivalent of gas (computational unit) |
| **FPC** | Fee-Paying Contract - enables fee abstraction |
| **Shielding** | Moving assets from public to private state |
| **Unshielding** | Moving assets from private to public state |

---

## Appendix B: Key Aztec Documentation References

- [Aztec Docs - Main](https://docs.aztec.network/)
- [Aztec Core Concepts](https://docs.aztec.network/developers/docs/concepts)
- [Portal Contracts (L1<>L2)](https://docs.aztec.network/developers/docs/concepts/communication/portals)
- [Notes (UTXOs)](https://docs.aztec.network/developers/docs/concepts/storage/notes)
- [Authentication Witnesses](https://docs.aztec.network/aztec/concepts/accounts/authwit)
- [Accounts & Keys](https://docs.aztec.network/aztec/concepts/accounts)
- [Fees & Mana](https://docs.aztec.network/aztec/concepts/fees)
- [Storage Types](https://docs.aztec.network/developers/guides/smart_contracts/storage_types)
- [Token Contract Tutorial](https://docs.aztec.network/tutorials/codealong/contract_tutorials/token_contract)
- [Token Bridge Tutorial](https://docs.aztec.network/tutorials/codealong/contract_tutorials/advanced/token_bridge)
- [Uniswap L1 Swap from L2](https://docs.aztec.network/developers/tutorials/codealong/js_tutorials/uniswap)
