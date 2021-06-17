import * as msal from "@azure/msal-browser";


const ssoLib = (config) => {
  let settings = {
    clientId: null,
    b2cEnvirontment: 'PhilaB2CDev',
    authorityDomain: 'PhilaB2CDev.b2clogin.com',
    redirectUri: 'http://localhost:3000/auth',
    signUpSignInPolicy: 'B2C_1A_SIGNUP_SIGNIN',

    signInAction: 'auth/authenticate',
    signOutAction: 'auth/signOut',
  };

  const localSettings = !config ? {} : config;
  for (const s in localSettings) {
    if (typeof settings[s] !== 'undefined') {
      settings[s] = localSettings[s];
    }
  }

  const b2cPolicies = {
    names: {
      signUpSignIn: settings.signUpSignInPolicy,
    },
    authorities: {
      signUpSignIn: {
        authority: `https://${settings.authorityDomain}/${settings.b2cEnvirontment}.onmicrosoft.com/${settings.signUpSignInPolicy}`,
      },
      forgotPassword: {
        authority: `https://${settings.authorityDomain}/${settings.b2cEnvirontment}.onmicrosoft.com/B2C_1A_PASSWORDRESET`,
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
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
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
        },
      },
    },
  };
  
  const apiConfig = {
    b2cScopes: [ `https://${settings.b2cEnvirontment}.onmicrosoft.com/api/read_data` ],
  };
  
  const loginRequest = {
    scopes: [ "openid", ...apiConfig.b2cScopes ],
  };
  
  const tokenRequest = {
    scopes: [ ...apiConfig.b2cScopes ],
    forceRefresh: false,
  };
  
  let myMSALObj = new msal.PublicClientApplication(msalConfig);
  
  // Store object. 
  const phillyAccount = {
    namespaced: true,
    state: ({
      signInAction: settings.signInAction,
      signOutAction: settings.signOutAction,
  
      msalAccount: {},
      accessToken: null,
  
      // Statuses
      signingIn: false,
      signingOut: false,
      redirectingForgotPassword: false,
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
  
      async msalSignIn({ commit }) {
        commit('setSigningIn', true);
        myMSALObj.loginRedirect(loginRequest);
      },
  
      async msalSignOut({ state, commit, dispatch }) {
        commit('setSigningOut', true);
        const logoutRequest = {
          postLogoutRedirectUri: msalConfig.auth.redirectUri,
        };
        await dispatch(state.signOutAction, {}, { root: true });
        myMSALObj.logoutRedirect(logoutRequest);
      },
  
      msalForgotPassword({ commit }) {
        commit('setRedirectingForgotPassword', true);
        myMSALObj.loginRedirect(b2cPolicies.authorities.forgotPassword);
      },
  
      async getAuthToken({ state, commit, dispatch }) {
        tokenRequest.account = myMSALObj.getAccountByHomeId(state.msalAccount.homeAccountId);
  
        try {
          const response = await myMSALObj.acquireTokenSilent(tokenRequest);
          if (!response.accessToken || response.accessToken === "") {
            throw new msal.InteractionRequiredAuthError;
          } else {
            console.log("access_token acquired at: " + new Date().toString());
            commit('setToken', response.accessToken);
            await dispatch(state.signInAction, response.accessToken, { root: true });
          }
        } catch (error) {
          console.log("Silent token acquisition fails. Acquiring token using redirect. \n", error);
          if (error instanceof msal.InteractionRequiredAuthError) {
            // fallback to interaction when silent call fails
            try {
              return myMSALObj.acquireTokenRedirect(tokenRequest);
            } catch (error) {
              console.log(error);
            }
          } else {
            console.log(error);
          }
        }
      },

      handleRedirect({ commit, dispatch }) {
        myMSALObj.handleRedirectPromise()
          .then(response => {
            if (response) {
              if (response.idTokenClaims['acr'].toUpperCase() === b2cPolicies.names.signUpSignIn.toUpperCase()) {
                // Set the state signing-in to true, the user is still signing into the system.
                commit('setSigningIn', true);

                // Set the phillyAccount information into the state
                dispatch('selectAccount');

                // Let's get the SSO token.
                dispatch('getAuthToken');
              }
            }
          })
          .catch(error => {
            console.log(error);
            if (error.errorMessage) {
              if (error.errorMessage.indexOf("AADB2C90118") > -1) {
                dispatch('msalForgotPassword');
              } else {
                if (this.$route) {
                  this.$route.push(msalConfig.auth.redirectUri);
                } else {
                  document.location = msalConfig.auth.redirectUri;
                }
              }
            }
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
 
    store.dispatch('phillyAccount/handleRedirect');
  },
};
