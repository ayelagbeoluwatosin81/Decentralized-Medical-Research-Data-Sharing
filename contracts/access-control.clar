;; Access Control Contract
;; Manages permissions for specific datasets

(define-data-var admin principal tx-sender)

;; Map to store dataset access permissions
(define-map dataset-permissions
  { dataset-id: uint, accessor: principal }
  {
    granted-by: principal,
    access-level: uint,
    expiration: uint,
    active: bool
  }
)

;; Map to store dataset owners
(define-map dataset-owners
  { dataset-id: uint }
  { owner: principal }
)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-NOT-OWNER u101)
(define-constant ERR-PERMISSION-NOT-FOUND u102)
(define-constant ERR-DATASET-NOT-FOUND u103)

;; Access levels
(define-constant ACCESS-LEVEL-READ u1)
(define-constant ACCESS-LEVEL-ANALYZE u2)
(define-constant ACCESS-LEVEL-FULL u3)

;; Check if caller is admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Register a new dataset
(define-public (register-dataset (dataset-id uint))
  (begin
    (map-set dataset-owners { dataset-id: dataset-id } { owner: tx-sender })
    (ok true)
  )
)

;; Check if caller is dataset owner
(define-private (is-dataset-owner (dataset-id uint))
  (match (map-get? dataset-owners { dataset-id: dataset-id })
    owner-data (is-eq tx-sender (get owner owner-data))
    false
  )
)

;; Grant access to a dataset
(define-public (grant-access (dataset-id uint) (accessor principal) (access-level uint) (expiration uint))
  (begin
    (asserts! (is-dataset-owner dataset-id) (err ERR-NOT-OWNER))
    (map-set dataset-permissions
      { dataset-id: dataset-id, accessor: accessor }
      {
        granted-by: tx-sender,
        access-level: access-level,
        expiration: expiration,
        active: true
      }
    )
    (ok true)
  )
)

;; Revoke access to a dataset
(define-public (revoke-access (dataset-id uint) (accessor principal))
  (begin
    (asserts! (is-dataset-owner dataset-id) (err ERR-NOT-OWNER))
    (match (map-get? dataset-permissions { dataset-id: dataset-id, accessor: accessor })
      permission-data (begin
        (map-set dataset-permissions
          { dataset-id: dataset-id, accessor: accessor }
          (merge permission-data { active: false })
        )
        (ok true)
      )
      (err ERR-PERMISSION-NOT-FOUND)
    )
  )
)

;; Check if a principal has access to a dataset
(define-read-only (has-access (dataset-id uint) (accessor principal))
  (match (map-get? dataset-permissions { dataset-id: dataset-id, accessor: accessor })
    permission-data (and
                      (get active permission-data)
                      (> (get expiration permission-data) block-height))
    false
  )
)

;; Get access details
(define-read-only (get-access-details (dataset-id uint) (accessor principal))
  (map-get? dataset-permissions { dataset-id: dataset-id, accessor: accessor })
)

;; Transfer dataset ownership
(define-public (transfer-dataset-ownership (dataset-id uint) (new-owner principal))
  (begin
    (asserts! (is-dataset-owner dataset-id) (err ERR-NOT-OWNER))
    (map-set dataset-owners { dataset-id: dataset-id } { owner: new-owner })
    (ok true)
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
