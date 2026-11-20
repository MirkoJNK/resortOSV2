# Discount Management — Financial Rules, Persistence and Limitations

## 1. Monetary representation

- Monetary input and stored totals are integer Philippine centavos, never floating-point peso totals.
- Percentages are integer basis points: `2000` means 20.00%; `1000` means 10.00%.
- Each division uses nonnegative `BigInt` and **half-up rounding to one centavo**.
- The domain validates recorded quantities, portion shares, percentages, dates, and a conservative maximum of `999,999,999,999` centavos.
- One discount may contain several item allocations; each selected recorded line has an eligible integer quantity plus a `sharePercent` from 1 to 100. Across all applied discounts, the total eligible percentage-quantity may not exceed remaining recorded quantity × 100.

## 2. Calculation pipeline

For each live Restaurant order, let `gross` be the sum of original unit-price snapshots × remaining recorded quantities (recorded removals excluded). Draft items do **not** count until recorded.

For each **statutory** election, eligible consumption is the sum of manually selected eligible quantities and portions:

1. If the resort is explicitly configured as **VAT registered with VAT-inclusive menu prices**, calculate `eligibleNet = roundHalfUp(eligibleGross × 100 / 112)` and `vatRelief = eligibleGross − eligibleNet`.
2. If explicitly configured as **non-VAT**, `eligibleNet = eligibleGross`, and `vatRelief = 0`.
3. `statutoryDiscount = roundHalfUp(eligibleNet × configuredRate / 10000)`.

The calculation rejects statutory selection while VAT treatment is **not configured**. The current prototype supports only the stated 12% VAT-inclusive or non-VAT menu-price models; VAT-exclusive prices, complex mixed VAT, other taxes, tax-invoice generation and official tax deduction claims are not supported.

For an ordinary promotion:

- Percentage: `discount = roundHalfUp(eligibleGross × configuredRate / 10000)`.
- Fixed amount: `discount = configuredFixedCentavos` and must not exceed the selected eligible subtotal.
- Promotions do not themselves create VAT exemption.

Multiple statutory elections are permitted only when their allocated quantities/shares do not overlap. Stacking a custom promotion with a statutory benefit, or stacking multiple promotions, is explicitly rejected. Restaurant staff must select the legally appropriate or more favorable available benefit; the demo does not independently adjudicate personal entitlement.

Then:

```text
discountedSubtotal = gross − totalVATRelief − totalDiscounts
restaurantServiceCharge = roundHalfUp(discountedSubtotal × enabledServiceRate / 10000)
finalPayable = discountedSubtotal + restaurantServiceCharge
```

Service-charge base is deliberately the subtotal **after** discounts and eligible VAT relief; it never includes itself. This is one documented demo billing convention requiring explicit business/legal review, **not** a statement of mandatory Philippine tax accounting treatment. Service charges apply only to Restaurant orders, never to Front Desk Service Catalog charges or Checkout as an added fee.

### Independently verified examples

| Scenario | Original | VAT relief | Discount | Service charge | Payable |
| --- | ---: | ---: | ---: | ---: | ---: |
| PWD, VAT-inclusive eligible ₱1,120.00, no service | ₱1,120.00 | ₱120.00 | ₱200.00 | ₱0.00 | **₱800.00** |
| Same, with explicitly enabled 10% service | ₱1,120.00 | ₱120.00 | ₱200.00 | ₱80.00 | **₱880.00** |
| One Senior Citizen portion of five × ₱100, non-VAT | ₱500.00 | ₱0.00 | ₱20.00 | ₱0.00 | **₱480.00** |
| One eligible 25% share of a ₱400 dish, non-VAT | ₱400.00 | ₱0.00 | ₱20.00 | ₱0.00 | **₱380.00** |

## 3. Statutory rules

- Senior Citizen 20% default: Republic Act No. 9994 and BIR RR No. 7-2010.
- PWD 20% default: Republic Act No. 10754 and BIR RR No. 5-2017.
- A statutory edit requires explicit confirmation, a reason, an effective date and preserved prior configuration. A future verified legal amendment can update the guarded legal minimum and citation with a detailed reason. This is a **demo administrative safeguard**, not an authenticated approval workflow.
- Staff must affirm they checked eligibility and select exactly which recorded items/portions qualify. The software does **not** verify government IDs; it neither collects nor stores personal ID numbers or ID images.
- BIR rules require documentation beyond this demo's snapshot, including identity/ID and invoice information for tax-deduction purposes. This build **cannot be used as a compliant statutory invoice or tax-return ledger**.

Official sources consulted:

- [RA 9994 / expanded senior citizen IRR](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/10/55830)
- [PWD RR 5-2017 (NCDA)](https://ncda.gov.ph/disability-laws/implementing-rules-and-regulations-irr/revenue-regulations-no-5-2017-rules-and-regulations-implementing-republic-act-no-10754/)
- [PWD IRR, including favorable promotion rule (NCDA)](https://ncda.gov.ph/disability-laws/implementing-rules-and-regulations-irr/irr-of-ra-10754-an-act-expanding-the-benefits-and-privileges-of-persons-with-disability-pwd/)
- [RA 11360 / service-charge distribution](https://lawphil.net/statutes/repacts/ra2019/ra_11360_2019.html)
- [DOLE 2024 revised service-charge implementation](https://bwc.dole.gov.ph/dole-issues-revised-rules-on-service-charge-law/)

## 4. Historical integrity and integration

- Database name remains `resortos:restaurant-operations:v1`. IndexedDB version moves from **5 to 6**, adding only a new `restaurant-finance-config` store. Existing stores and data are not reset or remapped.
- Empty settings store reads as safe defaults (0% disabled service, VAT unconfigured, statutory rules installed); invalid saved settings **throw** and do not overwrite the stored record.
- Settings and operations have distinct optimistic revision checks. A Restaurant settlement that uses settings passes the expected finance revision into the **same IndexedDB write transaction** as the operations commit; stale rate changes abort the settlement.
- Each new settlement stores its **payable amount and immutable calculation snapshot** with rule IDs/versions/names/rates, eligible totals, VAT relief, service rate/version/amount and calculation time. Order allocations remain linked in the recorded Restaurant order.
- `isValidOperations` validates snapshot reconciliation against the unchanged recorded order/allocations and all payment/checkout balances.
- Front Desk receives the `settlement.amountCentavos` **final amount**. Restaurant Orders shows stored totals for completed orders and current calculation for open orders. Charges, individual payments and Checkout never recalculate the old discount or service charge.
- Historical settlement records without a finance snapshot remain valid under their original recorded gross amount.
- If a recorded removal invalidates a previously selected fixed promotion or allocated portions, the invalid election is cleared, an explicit review flag is stored, and payment is blocked until the employee confirms the revised selection.
- A 100% custom promotion can produce a zero-value **complimentary cash close**. Zero-value room postings are not created.
- Previously paid orders are never rewritten by changes to Admin settings. No late paid-charge adjustment feature is present.

## 5. Not yet covered

Production authentication, authoritative multi-user backend validation, legally complete customer/invoice records, statutory entitlement verification, audit-grade change approvals, full legally distinct bill splitting, advanced VAT/tax cases, payroll distribution of service charges and late adjustment/refund mechanisms remain future work.
