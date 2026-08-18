# Primetech OS — Project Forms Module

Added: Project Forms tab, project registration, automatic PD-YYYY-NNN IDs, Firestore-backed project documents, lifecycle checklist, quotation calculator, and forms from intake through maintenance.

## Firestore
`projects/{projectDocId}` stores project information. `projects/{projectDocId}/forms/{formId}` stores project documents. `project_counters/{year}` stores the yearly sequence.

The module uses the existing Firebase app; it does not contain credentials. Your existing Firebase initialization must run before `project-forms.js`.

## Security
Add authentication and Firestore rules before production. Have the contract language legally reviewed before using it as a binding agreement.
