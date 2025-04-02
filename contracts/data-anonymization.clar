;; Data Anonymization Contract
;; Removes personally identifiable information

(define-data-var admin principal tx-sender)

;; Map to store anonymization methods
(define-map anonymization-methods uint
  {
    name: (string-utf8 100),
    description: (string-utf8 500),
    active: bool
  }
)

;; Map to track anonymized datasets
(define-map anonymized-datasets uint
  {
    original-hash: (buff 32),
    anonymized-hash: (buff 32),
    method-id: uint,
    anonymizer: principal,
    timestamp: uint
  }
)

;; Counter for dataset IDs
(define-data-var dataset-id-counter uint u0)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-METHOD-NOT-FOUND u101)
(define-constant ERR-DATASET-NOT-FOUND u102)

;; Check if caller is admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Register a new anonymization method
(define-public (register-anonymization-method (method-id uint) (name (string-utf8 100)) (description (string-utf8 500)))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (map-set anonymization-methods method-id {
      name: name,
      description: description,
      active: true
    })
    (ok true)
  )
)

;; Deactivate an anonymization method
(define-public (deactivate-anonymization-method (method-id uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (match (map-get? anonymization-methods method-id)
      method-data (begin
        (map-set anonymization-methods method-id
          (merge method-data { active: false })
        )
        (ok true)
      )
      (err ERR-METHOD-NOT-FOUND)
    )
  )
)

;; Register an anonymized dataset
(define-public (register-anonymized-dataset (original-hash (buff 32)) (anonymized-hash (buff 32)) (method-id uint))
  (begin
    (asserts! (is-some (map-get? anonymization-methods method-id)) (err ERR-METHOD-NOT-FOUND))

    (let ((new-id (+ (var-get dataset-id-counter) u1)))
      (var-set dataset-id-counter new-id)
      (map-set anonymized-datasets new-id {
        original-hash: original-hash,
        anonymized-hash: anonymized-hash,
        method-id: method-id,
        anonymizer: tx-sender,
        timestamp: block-height
      })
      (ok new-id)
    )
  )
)

;; Get anonymization method details
(define-read-only (get-anonymization-method (method-id uint))
  (map-get? anonymization-methods method-id)
)

;; Get anonymized dataset details
(define-read-only (get-anonymized-dataset (dataset-id uint))
  (map-get? anonymized-datasets dataset-id)
)

;; Verify if a dataset has been anonymized
(define-read-only (verify-anonymization (dataset-id uint) (claimed-hash (buff 32)))
  (match (map-get? anonymized-datasets dataset-id)
    dataset (ok (is-eq (get anonymized-hash dataset) claimed-hash))
    (err ERR-DATASET-NOT-FOUND)
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set admin new-admin)
    (ok true)
  )
)
