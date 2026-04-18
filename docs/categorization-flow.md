# Transaction Categorization Flow

High-level view of how an uncategorized transaction is processed through the three-tier cascade in `src/index.ts`.

```mermaid
flowchart TD
    Start([Uncategorized Transaction]) --> Enrich[Enrich Context<br/>• Calendar events<br/>• Payee history<br/>• Pattern match]

    Enrich --> Stage1{{"<b>Stage 1: Deterministic</b><br/>Pattern rules + history"}}
    Stage1 -->|Match| Done1([✓ Categorized])
    Stage1 -->|Inconclusive| Identity[Identity Resolver<br/>Brave search → merchant info]

    Identity --> Stage2{{"<b>Stage 2: AI Fast Match</b><br/>LLM picks category ID<br/>temp=0.1"}}
    Stage2 -->|Valid category ID| Done2([✓ Categorized])
    Stage2 -->|INCONCLUSIVE| Stage3{{"<b>Stage 3: AI Reasoning</b><br/>LLM returns JSON<br/>reasoning + confidence"}}

    Stage3 --> Done3([✓ Logged with reasoning])

    style Stage1 fill:#d4edda,stroke:#28a745,color:#000
    style Stage2 fill:#fff3cd,stroke:#ffc107,color:#000
    style Stage3 fill:#f8d7da,stroke:#dc3545,color:#000
    style Done1 fill:#e7f5e9,color:#000
    style Done2 fill:#e7f5e9,color:#000
    style Done3 fill:#e7f5e9,color:#000
```

## The three-tier cascade

| Tier | Cost | Method | Exit condition |
|---|---|---|---|
| **Stage 1** | Free | Deterministic pattern rules + historical payee count | `hasDeterministicMatch === true` |
| **Stage 2** | Cheap LLM call | Structured prompt, returns category ID or `INCONCLUSIVE` | Valid category ID returned |
| **Stage 3** | Expensive LLM call | Reasoning prompt, returns JSON with confidence | Always logs — terminal tier |

Identity resolution (Brave search) runs **between** Stage 1 and Stage 2 to enrich the prompt with merchant info when Stage 1 fails.
