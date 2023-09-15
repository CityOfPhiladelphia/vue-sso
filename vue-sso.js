import * as msal from "@azure/msal-browser";

let myMSALObj = null;

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

const ssoLib = (Vue) => {
  // Store object.
  const phillyAccount = {
    namespaced: true,
    state: {
      customPostbackObject: {},

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
        signInAction: "auth/authenticate",
        signOutAction: "auth/signOut",
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
    },

    mutations: {
      setMSALObject(state, config) {
        myMSALObj = null;

        state.b2cScopes = [
          `https://${state.settings.b2cEnvironment}.onmicrosoft.com/api/read_data`,
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
        state.settings.loginRequestScopes = ["openid", ...state.b2cScopes];
        state.settings.tokenRequestScopes = [...state.b2cScopes];

        const localSettings = !config ? {} : config;
        for (const s in localSettings) {
          if (typeof state.settings[s] !== "undefined") {
            Vue.set(state.settings, s, localSettings[s]);
            console.log(`Setting ${s} to ${localSettings[s]}`);
          }
        }

        if (state.settings.state != null) {
          if (state.settings.debug)
            console.log(
              "state.settings.state: ",
              JSON.stringify(state.settings.state)
            );
          state.settings.state = window.btoa(
            JSON.stringify({ ...state.settings.state })
          );
        }

        state.signInAction = state.settings.signInAction;
        state.signOutAction = state.settings.signOutAction;
        state.forgotPasswordAction = state.settings.forgotPasswordAction;
        state.errorHandler = state.settings.errorHandler;
        state.debug = state.settings.debug;

        // Set postLogoutRedirectUri
        if (!state.settings.postLogoutRedirectUri) {
          state.settings.postLogoutRedirectUri = state.settings.redirectUri;
        }

        let signUpSignInAuthority = "";
        if (!state.settings.tenantId) {
          signUpSignInAuthority = `https://${state.settings.authorityDomain}/${state.settings.b2cEnvironment}.onmicrosoft.com/${state.settings.signUpSignInPolicy}`;
        } else {
          signUpSignInAuthority = `https://${state.settings.authorityDomain}/${state.settings.tenantId}/${state.settings.signUpSignInPolicy}`;
        }

        let forgotPasswordAuthority = "";
        if (!state.settings.tenantId) {
          forgotPasswordAuthority = `https://${state.settings.authorityDomain}/${state.settings.b2cEnvironment}.onmicrosoft.com/${state.settings.resetPasswordPolicy}`;
        } else {
          forgotPasswordAuthority = `https://${state.settings.authorityDomain}/${state.settings.tenantId}/${state.settings.resetPasswordPolicy}`;
        }

        let signInOnlyAuthority = "";
        if (!state.settings.tenantId) {
          signInOnlyAuthority = `https://${state.settings.authorityDomain}/${state.settings.b2cEnvironment}.onmicrosoft.com/${state.settings.signInOnlyPolicy}`;
        } else {
          signInOnlyAuthority = `https://${state.settings.authorityDomain}/${state.settings.tenantId}/${state.settings.signInOnlyPolicy}`;
        }

        state.b2cPolicies = {
          names: {
            signUpSignIn: state.settings.signUpSignInPolicy,
            forgotPassword: state.settings.resetPasswordPolicy,
            signInOnly: state.settings.signInOnlyPolicy,
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
          authorityDomain: state.settings.authorityDomain,
        };

        state.msalConfig = {
          auth: {
            clientId: state.settings.clientId,
            authority1: {
              authority: state.b2cPolicies.authorities.signUpSignIn.authority,
              clientId: state.settings.clientId,
              signInPolicy: state.b2cPolicies.names.signUpSignIn,
            },
            authority2: {
              authority: state.b2cPolicies.authorities.signInOnly.authority,
              clientId: state.settings.clientId,
              signInPolicy: state.b2cPolicies.names.signInOnly,
            },
            knownAuthorities: [state.b2cPolicies.authorityDomain],
            redirectUri: state.settings.redirectUri,
            postLogoutRedirectUri: state.settings.postLogoutRedirectUri,
            navigateToLoginRequestUrl: false,
          },
          cache: {
            cacheLocation: "sessionStorage",
            storeAuthStateInCookie: false,
          },
          system: {
            logger: state.settings.debug
              ? new msal.Logger(loggerCallback, {
                  level: msal.LogLevel.Verbose,
                  piiLoggingEnabled: false,
                })
              : null,
          },
        };

        state.loginRequest = {
          scopes: state.settings.loginRequestScopes,
          state: state.settings.state,
        };

        state.tokenRequest = {
          scopes: state.settings.tokenRequestScopes,
          forceRefresh: false,
        };

        myMSALObj = new msal.PublicClientApplication(state.msalConfig);
      },
      setLoginRequest(state, payload) {
        state.loginRequest = Object.assign(state.loginRequest, payload);
      },
      setTokenRequest(state, payload) {
        state.tokenRequest.account = myMSALObj.getAccountByHomeId(
          state.msalAccount.homeAccountId
        );

        let authoritySettings = {};
        if (state.signingInPolicy === "signUpSignIn") {
          authoritySettings = {
            authority: state.msalConfig.auth.authority1.authority,
            signInPolicy: state.msalConfig.auth.authority1.signInPolicy,
            clientId: state.msalConfig.auth.authority1.clientId,
          };
        } else if (state.signingInPolicy === "signInOnly") {
          authoritySettings = {
            authority: state.msalConfig.auth.authority2.authority,
            signInPolicy: state.msalConfig.auth.authority2.signInPolicy,
            clientId: state.msalConfig.auth.authority2.clientId,
          };
        }

        payload = {
          ...payload,
          ...authoritySettings,
        };

        state.tokenRequest = Object.assign(state.tokenRequest, payload);

        if (state.debug) console.log("Token request: ", state.tokenRequest);
      },
      setMSALAccount(state, account) {
        state.msalAccount = account;
      },
      setToken(state, token) {
        state.accessToken = token;
      },
      setSigningIn(state, signingIn) {
        state.signingIn = signingIn;
      },
      setSigningOut(state, signingOut) {
        state.signingOut = signingOut;
      },
      setRedirectingForgotPassword(state, redirectingForgotPassword) {
        state.redirectingForgotPassword = redirectingForgotPassword;
      },
      setCustomPostBackObject(state, customPostbackObject) {
        state.customPostbackObject = customPostbackObject;
      },
      setSigningInPolicy(state, signingInPolicy) {
        state.signingInPolicy = signingInPolicy;
      },
    },

    actions: {
      async selectAccount({ state, commit, dispatch }) {
        const currentAccounts = myMSALObj.getAllAccounts();

        if (currentAccounts.length < 1) {
          return;
        } else if (currentAccounts.length > 1) {
          const accounts = currentAccounts.filter(
            (account) =>
              account.homeAccountId
                .toUpperCase()
                .includes(
                  state.b2cPolicies.names[
                    `${state.signingInPolicy}`
                  ].toUpperCase()
                ) &&
              account.idTokenClaims.iss
                .toUpperCase()
                .includes(state.b2cPolicies.authorityDomain.toUpperCase()) &&
              account.idTokenClaims.aud === state.msalConfig.auth.clientId
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
              if (state.debug) console.log("Setting account to: ", accounts[0]);
              commit("setMSALAccount", accounts[0]);
            } else {
              // Multiple users detected. Logout all to be safe.
              await dispatch("msalSignOut");
              return null;
            }
          } else if (accounts.length === 1) {
            commit("setMSALAccount", accounts[0]);
          }
        } else if (currentAccounts.length === 1) {
          if (state.debug)
            console.log("Setting account to: ", currentAccounts[0]);
          commit("setMSALAccount", currentAccounts[0]);
        }

        return;
      },

      async msalSignIn({ state, commit }, params = {}) {
        commit("setSigningIn", true);
        commit("setLoginRequest", {
          ...params,
          ...{
            authority: state.msalConfig.auth.authority1.authority,
            signInPolicy: state.msalConfig.auth.authority1.signInPolicy,
            clientId: state.msalConfig.auth.authority1.clientId,
          },
        });
        if (state.debug) console.log("Login request: ", state.loginRequest);
        return myMSALObj.loginRedirect(state.loginRequest);
      },

      async cityEmployeeSignIn({ state, commit }, params = {}) {
        // commit("setSigningIn", true);
        commit("setLoginRequest", {
          ...params,
          ...{
            authority: state.msalConfig.auth.authority2.authority,
            signInPolicy: state.msalConfig.auth.authority2.signInPolicy,
            clientId: state.msalConfig.auth.authority2.clientId,
          },
        });
        if (state.debug) console.log("Login request: ", state.loginRequest);
        return myMSALObj.loginRedirect(state.loginRequest);
      },

      async msalSignOut({ state, commit, dispatch }, redirectQueryParams = "") {
        await myMSALObj.initialize();

        commit("setSigningOut", true);

        let redirectURL = state.msalConfig.auth.postLogoutRedirectUri;
        if (
          typeof redirectQueryParams === "string" &&
          redirectQueryParams != ""
        ) {
          redirectURL += `?${redirectQueryParams}`;
        }

        const logoutRequest = {
          postLogoutRedirectUri: redirectURL,
          ...{
            authority: state.msalConfig.auth.authority1.authority,
            signInPolicy: state.msalConfig.auth.authority1.signInPolicy,
            clientId: state.msalConfig.auth.authority1.clientId,
          },
        };
        await dispatch(state.signOutAction, {}, { root: true });
        return myMSALObj.logoutRedirect(logoutRequest);
      },

      msalForgotPassword({ state, commit }) {
        commit("setRedirectingForgotPassword", true);
        return myMSALObj.loginRedirect(
          state.b2cPolicies.authorities.forgotPassword
        );
      },

      async getAuthToken({ state, commit, dispatch }, params = {}) {
        commit("setTokenRequest", params);
        try {
          const response = await myMSALObj.acquireTokenSilent(
            state.tokenRequest
          );
          if (!response.accessToken || response.accessToken === "") {
            throw new msal.InteractionRequiredAuthError();
          } else {
            if (state.debug)
              console.log("access_token acquired at: " + new Date().toString());
            commit("setToken", response.accessToken);
            const payload = {
              ...response,
              customPostbackObject: state.customPostbackObject,
            };
            await dispatch(state.signInAction, payload, { root: true });
          }
        } catch (error) {
          if (state.debug)
            console.log(
              "Silent token acquisition fails. Acquiring token using redirect. \n",
              error
            );
          if (error instanceof msal.InteractionRequiredAuthError) {
            // fallback to interaction when silent call fails
            try {
              return myMSALObj.acquireTokenRedirect(state.tokenRequest);
            } catch (error) {
              if (state.debug) console.log(error);
            }
          } else {
            if (state.debug) console.log(error);
          }
        }
      },

      async handleRedirect({ state, commit, dispatch }, authTokenParams = {}) {
        if (state.debug)
          console.log("Attempting to handle redirect promise...");

        await myMSALObj.initialize();

        try {
          const response = await myMSALObj.handleRedirectPromise();
          if (state.debug)
            console.log("Redirect response: ", JSON.stringify(response));

          if (response) {
            if (
              response.idTokenClaims["acr"].toUpperCase() ===
              state.b2cPolicies.names.signUpSignIn.toUpperCase()
            ) {
              commit("setSigningInPolicy", "signUpSignIn");
            } else if (
              response.idTokenClaims["acr"].toUpperCase() ===
              state.b2cPolicies.names.signInOnly.toUpperCase()
            ) {
              commit("setSigningInPolicy", "signInOnly");
            } else {
              commit("setSigningInPolicy", null);
            }

            if (state.signingInPolicy) {
              // Set the state signing-in to true, the user is still signing into the system.
              commit("setSigningIn", true);

              // Set the phillyAccount information into the state
              await dispatch("selectAccount");

              // Let's get the SSO token.
              await dispatch("getAuthToken", authTokenParams);

              return response;
            } else if (
              response.idTokenClaims["acr"].toUpperCase() ===
              state.b2cPolicies.names.forgotPassword.toUpperCase()
            ) {
              if (state.debug) console.log("Went throu forgot password");
              if (state.forgotPasswordAction) {
                commit("setRedirectingForgotPassword", true);

                await dispatch(state.forgotPasswordAction, response, {
                  root: true,
                });
              }

              return response;
            }
          }

          commit("setSigningIn", false);
          return null;
        } catch (error) {
          if (state.debug)
            console.log("Error while handling redirect promise", error);

          if (error.errorMessage) {
            if (error.errorMessage.indexOf("AADB2C90118") > -1) {
              await dispatch("msalForgotPassword");
              return null;
            } else {
              if (error instanceof msal.AuthError) {
                // The user probably canceled the login. Just console.log it and ignore.
                if (state.debug) console.log("Error code: ", error.errorCode);
                if (state.debug)
                  console.log("Error message: ", error.errorMessage);
              } else {
                // I believe it is better to throw and error and let the user handle it at convinience.
                if (state.errorHandler) {
                  await dispatch(state.errorHandler, error, { root: true });
                } else {
                  throw Error(error);
                }
              }
              commit("setSigningIn", false);
            }
          }

          return error;
        }
      },
    },
  };

  return phillyAccount;
};

export default {
  install: (Vue, { store, config }) => {
    if (!store) {
      throw Error("You must pass-over the store when registering this plugin.");
    }

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

    if (config.debug)
      console.log("clientInfoObject: ", JSON.stringify(clientInfoObject));

    // Dinamically register module
    const phillyAccount = ssoLib(Vue);
    store.registerModule("phillyAccount", phillyAccount);

    store.commit("phillyAccount/setCustomPostBackObject", customPostbackObject);

    store.commit("phillyAccount/setMSALObject", config);

    // Handle page refresh.
    // store.dispatch("phillyAccount/selectAccount");

    if (!config.dontHandleRedirectAutomatically) {
      store.dispatch("phillyAccount/handleRedirect");
    }
  },
};
