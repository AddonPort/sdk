# Security policy

Please report vulnerabilities privately through GitHub Security Advisories once the repository is
public. Do not open a public issue for a vulnerability.

AddonPort sessions are transport handoffs, not device attestation. A claimed session proves that a
process holding its claim secret contacted the service; it does not prove the identity or
integrity of that process. Native clients must still show their own confirmation before installing
or launching an add-on.
