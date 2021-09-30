import * as msal from "@azure/msal-browser";

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
};

const ssoLib = (config) => {
  let settings = {
    clientId: null,
    b2cEnvirontment: 'PhilaB2CDev',
    authorityDomain: 'PhilaB2CDev.b2clogin.com',
    redirectUri: 'http://localhost:8080/auth',
    postLogoutRedirectUri: null,
    signUpSignInPolicy: 'B2C_1A_SIGNUP_SIGNIN',
    resetPasswordPolicy: 'B2C_1A_PASSWORDRESET',
    signInAction: 'auth/authenticate',
    signOutAction: 'auth/signOut',
    forgotPasswordAction: null,
    errorHandler: null,
    debug: false, // Adding debug instead of removing all console log, At least for now this is needed.
  };

  // Composed settings.
  let b2cScopes = [ `https://${settings.b2cEnvirontment}.onmicrosoft.com/api/read_data` ];
  settings.loginRequestScopes = [ "openid", ...b2cScopes ];
  settings.tokenRequestScopes = [ ...b2cScopes ];

  // Set postLogoutRedirectUri
  if (!settings.postLogoutRedirectUri) {
    settings.postLogoutRedirectUri = settings.redirectUri;
  }

  const localSettings = !config ? {} : config;
  for (const s in localSettings) {
    if (typeof settings[s] !== 'undefined') {
      settings[s] = localSettings[s];
    }
  }

  const b2cPolicies = {
    names: {
      signUpSignIn: settings.signUpSignInPolicy,
      forgotPassword: settings.resetPasswordPolicy
    },
    authorities: {
      signUpSignIn: {
        authority: `https://${settings.authorityDomain}/${settings.b2cEnvirontment}.onmicrosoft.com/${settings.signUpSignInPolicy}`,
      },
      forgotPassword: {
        authority: `https://${settings.authorityDomain}/${settings.b2cEnvirontment}.onmicrosoft.com/${settings.resetPasswordPolicy}`,
      },
    },
    authorityDomain: settings.authorityDomain,
  };
  
  const msalConfig = {
    auth: {
      clientId: settings.clientId,
      authority: b2cPolicies.authorities.signUpSignIn.authority,
      knownAuthorities: [ b2cPolicies.authorityDomain ],
      redirectUri: settings.redirectUri,
      postLogoutRedirectUri: settings.postLogoutRedirectUri,
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    },
    system: {
      logger: settings.debug ? new msal.Logger(
        loggerCallback, {
            level: msal.LogLevel.Verbose,
            piiLoggingEnabled: false,
        }) : null,
    },
  };
  
  let loginRequest = {
    scopes: settings.loginRequestScopes,
  };
  
  let tokenRequest = {
    scopes: settings.tokenRequestScopes,
    forceRefresh: false,
  };
  
  let myMSALObj = new msal.PublicClientApplication(msalConfig);
  
  // Store object. 
  const phillyAccount = {
    namespaced: true,
    state: ({
      signInAction: settings.signInAction,
      signOutAction: settings.signOutAction,
      forgotPasswordAction: settings.forgotPasswordAction,
      errorHandler: settings.errorHandler,
  
      msalAccount: {},
      accessToken: null,
  
      // Statuses
      signingIn: false,
      signingOut: false,
      redirectingForgotPassword: false,
      debug: settings.debug,
    }),
  
    mutations: {
      setMSALAccount(state, account) {
        state.msalAccount = account;
      },
      setToken(state, token) {
        state.accessToken = token;
      },
      setSigningIn(state, signingIn){
        state.signingIn = signingIn;
      },
      setSigningOut(state, signingOut) {
        state.signingOut = signingOut;
      },
      setRedirectingForgotPassword(state, redirectingForgotPassword) {
        state.redirectingForgotPassword = redirectingForgotPassword;
      },
    },
  
    actions: {
      async selectAccount({ commit, dispatch }) {
        const currentAccounts = myMSALObj.getAllAccounts();
  
        if (currentAccounts.length < 1) {
          return;
        } else if (currentAccounts.length > 1) {
          const accounts = currentAccounts.filter(account =>
            account.homeAccountId.toUpperCase().includes(b2cPolicies.names.signUpSignIn.toUpperCase())
                &&
                account.idTokenClaims.iss.toUpperCase().includes(b2cPolicies.authorityDomain.toUpperCase())
                &&
                account.idTokenClaims.aud === msalConfig.auth.clientId, 
          );
  
          if (accounts.length > 1) {
            // localAccountId identifies the entity for which the token asserts information.
            if (accounts.every(account => account.localAccountId === accounts[0].localAccountId)) {
              // All accounts belong to the same user
              commit('setMSALAccount', accounts[0]);
            } else {
              // Multiple users detected. Logout all to be safe.
              dispatch('msalSignOut');
            }
          } else if (accounts.length === 1) {
            commit('setMSALAccount', accounts[0]);
          }
  
        } else if (currentAccounts.length === 1) {
          commit('setMSALAccount', currentAccounts[0]);
        }
      },
  
      async msalSignIn({ commit }, params = {}) {
        commit('setSigningIn', true);
        loginRequest = Object.assign(loginRequest, params);
        myMSALObj.loginRedirect(loginRequest);
      },
  
      async msalSignOut({ state, commit, dispatch }, redirectQueryParams = '') {
        commit('setSigningOut', true);

        let redirectURL = msalConfig.auth.postLogoutRedirectUri;
        if (typeof redirectQueryParams === 'string') {
          redirectURL += `?${redirectQueryParams}`;
        }

        const logoutRequest = {
          postLogoutRedirectUri: redirectURL,
        };
        await dispatch(state.signOutAction, {}, { root: true });
        myMSALObj.logoutRedirect(logoutRequest);
      },
  
      msalForgotPassword({ commit }) {
        commit('setRedirectingForgotPassword', true);
        myMSALObj.loginRedirect(b2cPolicies.authorities.forgotPassword);
      },
  
      async getAuthToken({ state, commit, dispatch }, params = {}) {
        tokenRequest.account = myMSALObj.getAccountByHomeId(state.msalAccount.homeAccountId);
        tokenRequest = Object.assign(tokenRequest, params);
        try {
          const response = await myMSALObj.acquireTokenSilent(tokenRequest);
          if (!response.accessToken || response.accessToken === "") {
            throw new msal.InteractionRequiredAuthError;
          } else {
            if (state.debug) console.log("access_token acquired at: " + new Date().toString());
            commit('setToken', response.accessToken);
            await dispatch(state.signInAction, response.accessToken, { root: true });
          }
        } catch (error) {
          if (state.debug) console.log("Silent token acquisition fails. Acquiring token using redirect. \n", error);
          if (error instanceof msal.InteractionRequiredAuthError) {
            // fallback to interaction when silent call fails
            try {
              return myMSALObj.acquireTokenRedirect(tokenRequest);
            } catch (error) {
              if (state.debug) console.log(error);
            }
          } else {
            if (state.debug) console.log(error);
          }
        }
      },

      handleRedirect({ state, commit, dispatch }, authTokenParams = {}) {
        if (state.debug) console.log('Attempting to handle redirect promise...');
        myMSALObj.handleRedirectPromise()
          .then(response => {
            if (state.debug) console.log("Redirect response: ", response);
            if (response) {
              if (response.idTokenClaims['acr'].toUpperCase() === b2cPolicies.names.signUpSignIn.toUpperCase()) {
                if (state.debug) console.log('Went throu login');

                // Set the state signing-in to true, the user is still signing into the system.
                commit('setSigningIn', true);

                // Set the phillyAccount information into the state
                dispatch('selectAccount');

                // Let's get the SSO token.
                dispatch('getAuthToken', authTokenParams);
              } else if (response.idTokenClaims['acr'].toUpperCase() === b2cPolicies.names.forgotPassword.toUpperCase()) {
                if (state.debug) console.log('Went throu forgot password');
                if (state.forgotPasswordAction) {
                  commit('setRedirectingForgotPassword', true);
                  dispatch(state.forgotPasswordAction, response, { root: true });
                }
              }
            }
            return;
          })
          .catch(error => {
            if (state.debug) console.log("Handle Redirect Error", error);
            if (error.errorMessage) {
              if (error.errorMessage.indexOf("AADB2C90118") > -1) {
                dispatch('msalForgotPassword');
              } else {
                // I believe it is better to throw and error and let the user handle it at convinience.
                if (state.errorHandler) {
                  dispatch(state.errorHandler, error, { root: true });
                } else {
                  throw Error(error);
                }
              }
            }
            return;
          });
      },
    },
  };

  return phillyAccount;
};

export default {
  install: (Vue, { store, config }) => {
    if (!store) {
      throw Error('You must pass-over the store when registering this plugin.');
    }

    // Dinamically register module
    const phillyAccount = ssoLib(config);
    store.registerModule('phillyAccount', phillyAccount);
  
    // Handle page refresh.
    store.dispatch('phillyAccount/selectAccount');
    
    if (!config.dontHandleRedirectAutomatically) {
      store.dispatch('phillyAccount/handleRedirect');
    }
  },
};
