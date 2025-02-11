import * as msal from "@azure/msal-browser";
import { reactive } from "vue";

// A few helpers.
function isAsyncFunction(func) {
  return Object.getPrototypeOf(func).constructor.name === "AsyncFunction";
}

function loggerCallback(level, message, containsPii) {
  if (containsPii) {
    return;
  }
  switch (level) {
    case msal.LogLevel.Error:
      console.error(message);
      return;
    case msal.LogLevel.Info:
      console.info(message);
      return;
    case msal.LogLevel.Verbose:
      console.debug(message);
      return;
    case msal.LogLevel.Warning:
      console.warn(message);
      return;
  }
}

// pinia module object.
export function createPhillyAccountPlugin(config) {
  if (!reactive) {
    throw new Error("Vue 3 is required to use this plugin.");
  }

  return (context) => {
    const { store } = context;

    if (!store) {
      console.error("Plugin must be used within a pinia store context.");
      return;
    }

    // store id must include the word auth
    if (!store.$id.toLowerCase().includes("auth")) {
      return;
    }

    if (config.debug) console.log("Connecting to store: ", store.$id);

    let clientInfoObject = {};
    let customPostbackObject = {};

    if (config.debug) console.log("Hash: ", window.location.hash);

    if (window.location.hash) {
      const regex = /client_info=([^&]+)/;
      const match = String(window.location.hash).match(regex);

      if (match && match[1]) {
        let clientInfoValue = decodeURIComponent(match[1]);
        clientInfoObject = JSON.parse(window.atob(clientInfoValue));
      }

      const regex2 = /state=([^&]+)/;
      const match2 = String(window.location.hash).match(regex2);

      if (match2 && match2[1]) {
        let state = decodeURIComponent(match2[1]);

        // split state value by Pipe |
        const states = state.split("|");

        if (config.debug) console.log("State values: ", states);

        if (states.length > 1) {
          customPostbackObject = JSON.parse(window.atob(states[1]));
        }
      }
    }

    const phillyAccountState = ({
      myMSALObj: null,
      customPostbackObject: customPostbackObject ? customPostbackObject : {},

      signInAction: "",
      signOutAction: "",
      forgotPasswordAction: "",
      errorHandler: "",

      msalAccount: {},
      accessToken: null,

      // Statuses
      signingIn: false,
      signingOut: false,
      redirectingForgotPassword: false,
      debug: false,

      signingInPolicy: null,

      b2cScopes: [],

      settings: {
        clientId: null,
        b2cEnvironment: "PhilaB2CDev",
        authorityDomain: "PhilaB2CDev.b2clogin.com",
        redirectUri: "http://localhost:8080/auth",
        postLogoutRedirectUri: null,
        signUpSignInPolicy: "B2C_1A_SIGNUP_SIGNIN",
        signInOnlyPolicy: "B2C_1A_AD_SIGNIN_ONLY",
        resetPasswordPolicy: "B2C_1A_PASSWORDRESET",
        signInAction: "signIn",
        signOutAction: "signOut",
        forgotPasswordAction: null,
        errorHandler: null,
        debug: false, // Adding debug instead of removing all console log, At least for now this is needed.
        tenantId: false,
        state: null,
      },

      b2cPolicies: {},
      msalConfig: {},
      loginRequest: {},
      tokenRequest: {},
    });

    const phillyAccountActions = {
      configMSALObject(config) {
        this.myMSALObj = null;
        this.b2cScopes = [
          `https://${this.settings.b2cEnvironment}.onmicrosoft.com/api/read_data`,
        ];

        // check if config.state is either null or an object. If not, then fail
        if (typeof config.state !== "object") {
          try {
            config.state = JSON.parse(window.atob(config.state));
          } catch (error) {
            // Silence is power.
            if (config.debug)
              console.log("State is not an object.", config.state);
            config.state = null;
          }
        }

        // Default scopes
        this.settings.loginRequestScopes = ["openid", ...this.b2cScopes];
        this.settings.tokenRequestScopes = [...this.b2cScopes];

        const localSettings = !config ? {} : config;
        for (const s in localSettings) {
          if (typeof this.settings[s] !== "undefined") {
            this.settings[s] = localSettings[s];
            console.log(`Setting ${s} to ${localSettings[s]}`);
          }
        }

        if (this.settings.state != null) {
          if (this.settings.debug)
            console.log(
              "this.settings.state: ",
              JSON.stringify(this.settings.state)
            );
          this.settings.state = window.btoa(
            JSON.stringify({ ...this.settings.state })
          );
        }

        this.signInAction = this.settings.signInAction;
        this.signOutAction = this.settings.signOutAction;
        this.forgotPasswordAction = this.settings.forgotPasswordAction;
        this.errorHandler = this.settings.errorHandler;
        this.debug = this.settings.debug;

        // Set postLogoutRedirectUri
        if (!this.settings.postLogoutRedirectUri) {
          this.settings.postLogoutRedirectUri = this.settings.redirectUri;
        }

        let signUpSignInAuthority = "";
        if (!this.settings.tenantId) {
          signUpSignInAuthority = `https://${this.settings.authorityDomain}/${this.settings.b2cEnvironment}.onmicrosoft.com/${this.settings.signUpSignInPolicy}`;
        } else {
          signUpSignInAuthority = `https://${this.settings.authorityDomain}/${this.settings.tenantId}/${this.settings.signUpSignInPolicy}`;
        }

        let forgotPasswordAuthority = "";
        if (!this.settings.tenantId) {
          forgotPasswordAuthority = `https://${this.settings.authorityDomain}/${this.settings.b2cEnvironment}.onmicrosoft.com/${this.settings.resetPasswordPolicy}`;
        } else {
          forgotPasswordAuthority = `https://${this.settings.authorityDomain}/${this.settings.tenantId}/${this.settings.resetPasswordPolicy}`;
        }

        let signInOnlyAuthority = "";
        if (!this.settings.tenantId) {
          signInOnlyAuthority = `https://${this.settings.authorityDomain}/${this.settings.b2cEnvironment}.onmicrosoft.com/${this.settings.signInOnlyPolicy}`;
        } else {
          signInOnlyAuthority = `https://${this.settings.authorityDomain}/${this.settings.tenantId}/${this.settings.signInOnlyPolicy}`;
        }

        this.b2cPolicies = {
          names: {
            signUpSignIn: this.settings.signUpSignInPolicy,
            forgotPassword: this.settings.resetPasswordPolicy,
            signInOnly: this.settings.signInOnlyPolicy,
          },
          authorities: {
            signUpSignIn: {
              authority: signUpSignInAuthority,
            },
            forgotPassword: {
              authority: forgotPasswordAuthority,
            },
            signInOnly: {
              authority: signInOnlyAuthority,
            },
          },
          authorityDomain: this.settings.authorityDomain,
        };

        this.msalConfig = {
          auth: {
            clientId: this.settings.clientId,
            authority1: {
              authority: this.b2cPolicies.authorities.signUpSignIn.authority,
              clientId: this.settings.clientId,
              signInPolicy: this.b2cPolicies.names.signUpSignIn,
            },
            authority2: {
              authority: this.b2cPolicies.authorities.signInOnly.authority,
              clientId: this.settings.clientId,
              signInPolicy: this.b2cPolicies.names.signInOnly,
            },
            knownAuthorities: [this.b2cPolicies.authorityDomain],
            redirectUri: this.settings.redirectUri,
            postLogoutRedirectUri: this.settings.postLogoutRedirectUri,
            navigateToLoginRequestUrl: false,
          },
          cache: {
            cacheLocation: "sessionStorage",
            storeAuthStateInCookie: false,
          },
          system: {
            logger: this.settings.debug
              ? new msal.Logger(loggerCallback, {
                  level: msal.LogLevel.Verbose,
                  piiLoggingEnabled: false,
                })
              : null,
          },
        };

        this.loginRequest = {
          scopes: this.settings.loginRequestScopes,
          state: this.settings.state,
        };

        this.tokenRequest = {
          scopes: this.settings.tokenRequestScopes,
          forceRefresh: false,
        };

        this.myMSALObj = new msal.PublicClientApplication(this.msalConfig);
      },

      async selectAccount() {
        const currentAccounts = this.myMSALObj.getAllAccounts();

        if (currentAccounts.length < 1) {
          return;
        } else if (currentAccounts.length > 1) {
          const accounts = currentAccounts.filter(
            (account) =>
              account.homeAccountId
                .toUpperCase()
                .includes(
                  this.b2cPolicies.names[
                    `${this.signingInPolicy}`
                  ].toUpperCase()
                ) &&
              account.idTokenClaims.iss
                .toUpperCase()
                .includes(this.b2cPolicies.authorityDomain.toUpperCase()) &&
              account.idTokenClaims.aud === this.msalConfig.auth.clientId
          );

          if (accounts.length > 1) {
            // localAccountId identifies the entity for which the token asserts information.
            if (
              accounts.every(
                (account) =>
                  account.localAccountId === accounts[0].localAccountId
              )
            ) {
              // All accounts belong to the same user
              if (this.debug) console.log("Setting account to: ", accounts[0]);
              this.msalAccount = accounts[0];
            } else {
              // Multiple users detected. Logout all to be safe.
              await store.msalSignOut();
              return null;
            }
          } else if (accounts.length === 1) {
            this.msalAccount = accounts[0];
          }
        } else if (currentAccounts.length === 1) {
          if (this.debug)
            console.log("Setting account to: ", currentAccounts[0]);
          this.msalAccount = currentAccounts[0];
        }

        return;
      },

      async msalSignIn(params = {}) {
        await this.myMSALObj.initialize();

        if (this.debug)
          console.log("What is this?", this);

        this.signingIn = true;
        this.loginRequest = Object.assign(this.loginRequest, {
          ...params,
          ...{
            authority: this.msalConfig.auth.authority1.authority,
            signInPolicy: this.msalConfig.auth.authority1.signInPolicy,
            clientId: this.msalConfig.auth.authority1.clientId,
          },
        });

        if (this.debug) console.log("Login request: ", this.loginRequest);
        return this.myMSALObj.loginRedirect(this.loginRequest);
      },

      async cityEmployeeSignIn(params = {}) {
        await this.myMSALObj.initialize();

        this.signingIn = true;
        this.loginRequest = Object.assign(this.loginRequest, {
          ...params,
          ...{
            authority: this.msalConfig.auth.authority2.authority,
            signInPolicy: this.msalConfig.auth.authority2.signInPolicy,
            clientId: this.msalConfig.auth.authority2.clientId,
          },
        });
        if (this.debug) console.log("Login request: ", this.loginRequest);
        return this.myMSALObj.loginRedirect(this.loginRequest);
      },

      async msalSignOut(redirectQueryParams = "") {
        await this.myMSALObj.initialize();

        this.setSigningOut = true;

        let redirectURL = this.msalConfig.auth.postLogoutRedirectUri;
        if (
          typeof redirectQueryParams === "string" &&
          redirectQueryParams != ""
        ) {
          redirectURL += `?${redirectQueryParams}`;
        }

        const logoutRequest = {
          postLogoutRedirectUri: redirectURL,
          ...{
            authority: this.msalConfig.auth.authority1.authority,
            signInPolicy: this.msalConfig.auth.authority1.signInPolicy,
            clientId: this.msalConfig.auth.authority1.clientId,
          },
        };
        if (this.signOutAction) {
          // Sign in action is a pinia store action. If it is set, then call it.
          if (store[this.signOutAction]) {
            if (isAsyncFunction(store[this.signOutAction])) {
              await store[this.signOutAction]();
            } else {
              store[this.signOutAction]();
            }
          }
        }
        return this.myMSALObj.logoutRedirect(logoutRequest);
      },

      async msalForgotPassword() {
        this.redirectingForgotPassword = true;
        return this.myMSALObj.loginRedirect(
          this.b2cPolicies.authorities.forgotPassword
        );
      },

      setTokenRequest(payload) {
        this.tokenRequest.account = this.myMSALObj.getAccountByHomeId(
          this.msalAccount.homeAccountId
        );

        let authoritySettings = {};
        if (this.signingInPolicy === "signUpSignIn") {
          authoritySettings = {
            authority: this.msalConfig.auth.authority1.authority,
            signInPolicy: this.msalConfig.auth.authority1.signInPolicy,
            clientId: this.msalConfig.auth.authority1.clientId,
          };
        } else if (this.signingInPolicy === "signInOnly") {
          authoritySettings = {
            authority: this.msalConfig.auth.authority2.authority,
            signInPolicy: this.msalConfig.auth.authority2.signInPolicy,
            clientId: this.msalConfig.auth.authority2.clientId,
          };
        }

        payload = {
          ...payload,
          ...authoritySettings,
        };

        this.tokenRequest = Object.assign(this.tokenRequest, payload);

        if (this.debug) console.log("Token request: ", this.tokenRequest);
      },

      async getAuthToken(params = {}) {
        store.setTokenRequest(params);
        try {
          const response = await this.myMSALObj.acquireTokenSilent(
            this.tokenRequest
          );
          if (!response.accessToken || response.accessToken === "") {
            throw new msal.InteractionRequiredAuthError();
          } else {
            if (this.debug)
              console.log("access_token acquired at: " + new Date().toString());
            this.accessToken = response.accessToken;
            const payload = {
              ...response,
              customPostbackObject: this.customPostbackObject,
            };
            if (this.signInAction) {
              if (store[this.signInAction]) {
                if (isAsyncFunction(store[this.signInAction])) {
                  await store[this.signInAction](payload);
                } else {
                  store[this.signInAction](payload);
                }
              }
            }
          }
        } catch (error) {
          if (this.debug)
            console.log(
              "Silent token acquisition fails. Acquiring token using redirect. \n",
              error
            );
          if (error instanceof msal.InteractionRequiredAuthError) {
            // fallback to interaction when silent call fails
            try {
              return this.myMSALObj.acquireTokenRedirect(this.tokenRequest);
            } catch (error) {
              if (this.debug) console.log(error);
            }
          } else {
            if (this.debug) console.log(error);
          }
        }
      },

      async handleRedirect(authTokenParams = {}) {
        if (this.debug) console.log("Attempting to handle redirect promise...");

        await this.myMSALObj.initialize();

        try {
          const response = await this.myMSALObj.handleRedirectPromise();
          if (this.debug)
            console.log("Redirect response: ", JSON.stringify(response));

          if (response) {
            if (
              response.idTokenClaims["acr"].toUpperCase() ===
              this.b2cPolicies.names.signUpSignIn.toUpperCase()
            ) {
              this.signingInPolicy = "signUpSignIn";
            } else if (
              response.idTokenClaims["acr"].toUpperCase() ===
              this.b2cPolicies.names.signInOnly.toUpperCase()
            ) {
              this.signingInPolicy = "signInOnly";
            } else {
              this.signingInPolicy = null;
            }

            if (this.signingInPolicy) {
              // Set the state signing-in to true, the user is still signing into the system.
              this.signingIn = true;

              // Set the phillyAccount information into the state
              await store.selectAccount();

              // Let's get the SSO token.
              await store.getAuthToken(authTokenParams);

              return response;
            } else if (
              response.idTokenClaims["acr"].toUpperCase() ===
              this.b2cPolicies.names.forgotPassword.toUpperCase()
            ) {
              if (this.debug) console.log("Went throu forgot password");
              if (this.forgotPasswordAction) {
                this.setRedirectingForgotPassword = true;
                if (store[this.forgotPasswordAction]) {
                  if (isAsyncFunction(store[this.forgotPasswordAction])) {
                    await store[this.forgotPasswordAction](response);
                  } else {
                    store[this.forgotPasswordAction](response);
                  }
                }
              }

              return response;
            }
          }

          this.signingIn = false;
          return null;
        } catch (error) {
          if (this.debug)
            console.log("Error while handling redirect promise", error);

          if (error.errorMessage) {
            if (error.errorMessage.indexOf("AADB2C90118") > -1) {
              await this.msalForgotPassword();
              return null;
            } else {
              if (error instanceof msal.AuthError) {
                // The user probably canceled the login. Just console.log it and ignore.
                if (this.debug) console.log("Error code: ", error.errorCode);
                if (this.debug)
                  console.log("Error message: ", error.errorMessage);
              } else {
                // I believe it is better to throw and error and let the user handle it at convinience.
                if (this.errorHandler) {
                  if (store[this.errorHandler]) {
                    if (isAsyncFunction(store[this.errorHandler])) {
                      await store[this.errorHandler](error);
                    } else {
                      store[this.errorHandler](error);
                    }
                  } else {
                    throw Error(error);
                  }
                } else {
                  throw Error(error);
                }
              }
              this.signingIn = false;
            }
          }

          return error;
        }
      },
    };

    store.$state.phillyAccount = reactive(phillyAccountState);
    Object.keys(phillyAccountActions).forEach((key) => {
      store[key] = phillyAccountActions[key].bind(store.$state.phillyAccount);
    });

    store.configMSALObject(config);

    if (!config.dontHandleRedirectAutomatically) {
      store.handleRedirect();
    }
  };
}
