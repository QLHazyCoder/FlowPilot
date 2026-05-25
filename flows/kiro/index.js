(function attachMultiPageKiroFlowDefinition(root, factory) {
  root.MultiPageKiroFlowDefinition = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageKiroFlowDefinition() {
  function freezeDeep(entry) {
    if (!entry || typeof entry !== 'object' || Object.isFrozen(entry)) {
      return entry;
    }
    Object.getOwnPropertyNames(entry).forEach((key) => {
      freezeDeep(entry[key]);
    });
    return Object.freeze(entry);
  }

  const VALUE = freezeDeep({
  "id": "kiro",
  "label": "Kiro",
  "services": [
    "account",
    "email",
    "proxy"
  ],
  "capabilities": {
    "supportsEmailSignup": true,
    "supportsPhoneSignup": false,
    "supportsPhoneVerificationSettings": false,
    "supportsPlusMode": false,
    "supportsContributionMode": false,
    "supportsAccountContribution": true,
    "supportsOpenAiOAuthContribution": false,
    "contributionAdapterIds": [
      "kiro-builder-id"
    ],
    "supportedTargetIds": [
      "kiro-rs"
    ],
    "supportsLuckmail": false,
    "canSwitchFlow": true,
    "stepDefinitionMode": "kiro",
    "targetSelectorLabel": "来源"
  },
  "baseGroups": [
    "kiro-runtime-status",
    "shared-auto-run",
    "shared-settings-actions"
  ],
  "targets": {
    "kiro-rs": {
      "id": "kiro-rs",
      "label": "kiro.rs",
      "defaultState": {
        "baseUrl": "",
        "apiKey": ""
      },
      "groups": [
        "kiro-target-kiro-rs"
      ]
    }
  },
  "publicationTargets": {
    "kiro-rs": {
      "id": "kiro-rs",
      "label": "kiro.rs"
    }
  },
  "runtimeSources": {
    "kiro-register-page": {
      "flowId": "kiro",
      "kind": "flow-page",
      "label": "Kiro 注册页",
      "readyPolicy": "top-frame-only",
      "family": "kiro-register-page-family",
      "driverId": "flows/kiro/content/register-page",
      "cleanupScopes": [],
      "detectionMatchers": [
        {
          "hostnames": [
            "app.kiro.dev",
            "kiro.dev"
          ]
        },
        {
          "hostnames": [
            "view.awsapps.com",
            "login.awsapps.com",
            "amazonaws.com"
          ],
          "hostnameFamilies": [
            "signin.aws",
            "profile.aws"
          ],
          "hostnameEndsWith": [
            ".amazonaws.com"
          ],
          "matchMode": "any"
        }
      ],
      "familyMatchers": [
        {
          "hostnames": [
            "app.kiro.dev",
            "kiro.dev"
          ]
        },
        {
          "hostnames": [
            "view.awsapps.com",
            "login.awsapps.com",
            "amazonaws.com"
          ],
          "hostnameFamilies": [
            "signin.aws",
            "profile.aws"
          ],
          "hostnameEndsWith": [
            ".amazonaws.com"
          ],
          "matchMode": "any"
        }
      ]
    },
    "kiro-desktop-authorize": {
      "flowId": "kiro",
      "kind": "flow-page",
      "label": "Kiro 桌面授权页",
      "readyPolicy": "top-frame-only",
      "family": "kiro-desktop-authorize-family",
      "driverId": "flows/kiro/content/desktop-authorize-page",
      "cleanupScopes": [],
      "familyMatchers": [
        {
          "hostnames": [
            "view.awsapps.com",
            "login.awsapps.com",
            "amazonaws.com"
          ],
          "hostnameFamilies": [
            "signin.aws",
            "profile.aws"
          ],
          "hostnameEndsWith": [
            ".amazonaws.com"
          ],
          "matchMode": "any"
        }
      ]
    },
    "kiro-rs-admin": {
      "flowId": "kiro",
      "kind": "virtual-page",
      "label": "kiro.rs Admin",
      "readyPolicy": "disabled",
      "family": "kiro-rs-admin-family",
      "driverId": null,
      "cleanupScopes": [],
      "familyMatchers": []
    }
  },
  "driverDefinitions": {
    "flows/kiro/content/register-page": {
      "sourceId": "kiro-register-page",
      "commands": [
        "kiro-open-register-page",
        "kiro-submit-email",
        "kiro-submit-name",
        "kiro-submit-verification-code",
        "kiro-submit-password",
        "kiro-complete-register-consent"
      ]
    },
    "flows/kiro/content/desktop-authorize-page": {
      "sourceId": "kiro-desktop-authorize",
      "commands": [
        "kiro-complete-desktop-authorize"
      ]
    },
    "flows/kiro/background/register-runner": {
      "sourceId": "kiro-register-page",
      "commands": [
        "kiro-open-register-page",
        "kiro-submit-email",
        "kiro-submit-name",
        "kiro-submit-verification-code",
        "kiro-submit-password",
        "kiro-complete-register-consent"
      ]
    },
    "flows/kiro/background/desktop-authorize-runner": {
      "sourceId": "kiro-desktop-authorize",
      "commands": [
        "kiro-start-desktop-authorize",
        "kiro-complete-desktop-authorize"
      ]
    },
    "flows/kiro/background/publisher-kiro-rs": {
      "sourceId": "kiro-rs-admin",
      "commands": [
        "kiro-upload-credential"
      ]
    }
  },
  "defaultTargetId": "kiro-rs",
  "defaultPublicationTargetId": "kiro-rs",
  "defaultTargetState": {
    "baseUrl": "",
    "apiKey": ""
  },
  "settingsGroups": {
    "kiro-target-kiro-rs": {
      "id": "kiro-target-kiro-rs",
      "label": "kiro.rs 配置",
      "rowIds": [
        "row-kiro-rs-url",
        "row-kiro-rs-key",
        "row-kiro-rs-test-status"
      ]
    },
    "kiro-runtime-status": {
      "id": "kiro-runtime-status",
      "label": "Kiro 运行态",
      "rowIds": [
        "row-kiro-web-status",
        "row-kiro-login-url",
        "row-kiro-upload-status"
      ]
    }
  },
  "sourceAliases": {}
});

  return VALUE;
});
