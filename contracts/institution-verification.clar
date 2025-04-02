;; Institution Verification Contract
;; Validates legitimate research entities

(define-data-var admin principal tx-sender)

;; Map to store verified institutions
(define-map verified-institutions principal
  {
    name: (string-utf8 100),
    verification-date: uint,
    verification-level: uint,
    active: bool
  }
)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-ALREADY-VERIFIED u101)
(define-constant ERR-NOT-FOUND u102)

;; Check if caller is admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Verify a new institution
(define-public (verify-institution (institution principal) (name (string-utf8 100)) (level uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-none (map-get? verified-institutions institution)) (err ERR-ALREADY-VERIFIED))

    (map-set verified-institutions institution {
      name: name,
      verification-date: block-height,
      verification-level: level,
      active: true
    })
    (ok true)
  )
)

;; Revoke verification
(define-public (revoke-verification (institution principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (match (map-get? verified-institutions institution)
      institution-data (begin
        (map-set verified-institutions institution
          (merge institution-data { active: false })
        )
        (ok true)
      )
      (err ERR-NOT-FOUND)
    )
  )
)

;; Check if an institution is verified
(define-read-only (is-verified (institution principal))
  (match (map-get? verified-institutions institution)
    institution-data (ok (get active institution-data))
    (err ERR-NOT-FOUND)
  )
)

;; Get institution details
(define-read-only (get-institution-details (institution principal))
  (map-get? verified-institutions institution)
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set admin new-admin)
    (ok true)
  )
)
