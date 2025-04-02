;; Usage Tracking Contract
;; Monitors how shared data is being utilized

(define-data-var admin principal tx-sender)

;; Map to store usage records
(define-map usage-records uint
  {
    dataset-id: uint,
    user: principal,
    usage-type: uint,
    timestamp: uint,
    details: (string-utf8 500)
  }
)

;; Counter for usage record IDs
(define-data-var usage-id-counter uint u0)

;; Map to store usage types
(define-map usage-types uint
  {
    name: (string-utf8 100),
    description: (string-utf8 500),
    active: bool
  }
)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-USAGE-TYPE-NOT-FOUND u101)
(define-constant ERR-USAGE-RECORD-NOT-FOUND u102)

;; Check if caller is admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Register a new usage type
(define-public (register-usage-type (type-id uint) (name (string-utf8 100)) (description (string-utf8 500)))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (map-set usage-types type-id {
      name: name,
      description: description,
      active: true
    })
    (ok true)
  )
)

;; Deactivate a usage type
(define-public (deactivate-usage-type (type-id uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (match (map-get? usage-types type-id)
      type-data (begin
        (map-set usage-types type-id
          (merge type-data { active: false })
        )
        (ok true)
      )
      (err ERR-USAGE-TYPE-NOT-FOUND)
    )
  )
)

;; Record dataset usage
(define-public (record-usage (dataset-id uint) (usage-type uint) (details (string-utf8 500)))
  (begin
    (asserts! (is-some (map-get? usage-types usage-type)) (err ERR-USAGE-TYPE-NOT-FOUND))

    (let ((new-id (+ (var-get usage-id-counter) u1)))
      (var-set usage-id-counter new-id)
      (map-set usage-records new-id {
        dataset-id: dataset-id,
        user: tx-sender,
        usage-type: usage-type,
        timestamp: block-height,
        details: details
      })
      (ok new-id)
    )
  )
)

;; Get usage type details
(define-read-only (get-usage-type (type-id uint))
  (map-get? usage-types type-id)
)

;; Get usage record details
(define-read-only (get-usage-record (record-id uint))
  (map-get? usage-records record-id)
)

;; Get all usage records for a dataset (limited by design to one record)
;; In a real implementation, you would need pagination or other mechanisms
(define-read-only (get-dataset-usage (dataset-id uint) (record-id uint))
  (match (map-get? usage-records record-id)
    record (if (is-eq (get dataset-id record) dataset-id)
              (some record)
              none)
    none
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
