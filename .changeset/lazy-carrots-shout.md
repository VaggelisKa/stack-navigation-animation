---
"@stacknav/angular": patch
"@stacknav/core": patch
---

Point the published manifests at the repository. npm rejects a provenance
attestation whose `repository.url` does not match the repository that built the
tarball, and both manifests had no `repository` field at all, so the 0.6.1 /
1.0.1 publish failed with E422. The packages now carry `repository`, `homepage`
and `bugs`.
