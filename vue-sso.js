import * as msal from "@azure/msal-browser";

const B2C_1A_AD_SIGNIN_ONLY = 'B2C_1A_AD_SIGNIN_ONLY';

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

const ssoLib = () => {
  // Store object. 
  const phillyAccount = {
    namespaced: true,
    state: ({
      signInAction: '',
      signOutAction: '',
      forgotPasswordAction: '',
      errorHandler: '',

      msalAccount: {},
      accessToken: null,

      // Statuses
      signingIn: false,
      signingOut: false,
      redirectingForgotPassword: false,
      debug: false,

      b2cScopes: [],

      settings: {
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
        tenantId: false,
        state: null,
        cityEmployee: false,
      },

      b2cPlicies: {},
      msalConfig: {},
      loginRequest: {},
      tokenRequest: {},
      myMSALObj: {},
    }),

    mutations: {
      setMSALObject(state, config) {
        state.myMSALObj = null;

        state.b2cScopes =  [`https://${state.settings.b2cEnvirontment}.onmicrosoft.com/api/read_data`];
        
        // Default scopes
        state.settings.loginRequestScopes = [ "openid", ...state.b2cScopes ];
        state.settings.tokenRequestScopes = [ ...state.b2cScopes ];

        const localSettings = !config ? {} : config;
        for (const s in localSettings) {
          if (typeof state.settings[s] !== 'undefined') {
            state.settings[s] = localSettings[s];
          }
        }

        if (state.settings.cityEmployee) {
          if (state.settings.debug) console.log('City employee detected');
          state.settings.signUpSignInPolicy = B2C_1A_AD_SIGNIN_ONLY;
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

        let signUpSignInAuthority = '';
        if (!state.settings.tenantId) {
          signUpSignInAuthority = `https://${state.settings.authorityDomain}/${state.settings.b2cEnvirontment}.onmicrosoft.com/${state.settings.signUpSignInPolicy}`;
        } else {
          signUpSignInAuthority = `https://${state.settings.authorityDomain}/${state.settings.tenantId}/${state.settings.signUpSignInPolicy}`;
        }

        let forgotPasswordAuthority = '';
        if (!state.settings.tenantId) {
          forgotPasswordAuthority = `https://${state.settings.authorityDomain}/${state.settings.b2cEnvirontment}.onmicrosoft.com/${state.settings.resetPasswordPolicy}`;
        } else {
          forgotPasswordAuthority = `https://${state.settings.authorityDomain}/${state.settings.tenantId}/${state.settings.resetPasswordPolicy}`;
        }

        state.b2cPolicies = {
          names: {
            signUpSignIn: state.settings.signUpSignInPolicy,
            forgotPassword: state.settings.resetPasswordPolicy
          },
          authorities: {
            signUpSignIn: {
              authority: signUpSignInAuthority,
            },
            forgotPassword: {
              authority: forgotPasswordAuthority,
            },
          },
          authorityDomain: state.settings.authorityDomain,
        };

        state.msalConfig = {
          auth: {
            clientId: state.settings.clientId,
            authority: state.b2cPolicies.authorities.signUpSignIn.authority,
            knownAuthorities: [state.b2cPolicies.authorityDomain],
            redirectUri: state.settings.redirectUri,
            postLogoutRedirectUri: state.settings.postLogoutRedirectUri,
          },
          cache: {
            cacheLocation: "sessionStorage",
            storeAuthStateInCookie: false,
          },
          system: {
            logger: state.settings.debug ? new msal.Logger(
              loggerCallback, {
              level: msal.LogLevel.Verbose,
              piiLoggingEnabled: false,
            }) : null,
          },
        };

        state.loginRequest = {
          scopes: state.settings.loginRequestScopes,
          state: state.settings.state
        };

        state.tokenRequest = {
          scopes: state.settings.tokenRequestScopes,
          forceRefresh: false,
        };

        state.myMSALObj = new msal.PublicClientApplication(state.msalConfig);
      },
      setLoginRequest(state, payload) {
        state.loginRequest = Object.assign(state.loginRequest, payload);
      },
      setTokenRequest(state, payload) {
        state.tokenRequest.account = state.myMSALObj.getAccountByHomeId(state.msalAccount.homeAccountId);
        state.tokenRequest = Object.assign(state.tokenRequest, payload);

        if (state.debug) console.log('Token request: ', state.tokenRequest);
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
    },

    actions: {
      async selectAccount({ state, commit, dispatch }) {
        const currentAccounts = state.myMSALObj.getAllAccounts();

        if (currentAccounts.length < 1) {
          return;
        } else if (currentAccounts.length > 1) {
          const accounts = currentAccounts.filter(account =>
            account.homeAccountId.toUpperCase().includes(state.b2cPolicies.names.signUpSignIn.toUpperCase())
            &&
            account.idTokenClaims.iss.toUpperCase().includes(state.b2cPolicies.authorityDomain.toUpperCase())
            &&
            account.idTokenClaims.aud === state.msalConfig.auth.clientId,
          );

          if (accounts.length > 1) {
            // localAccountId identifies the entity for which the token asserts information.
            if (accounts.every(account => account.localAccountId === accounts[0].localAccountId)) {
              // All accounts belong to the same user
              commit('setMSALAccount', accounts[0]);
            } else {
              // Multiple users detected. Logout all to be safe.
              await dispatch('msalSignOut');
              return null;
            }
          } else if (accounts.length === 1) {
            commit('setMSALAccount', accounts[0]);
          }

        } else if (currentAccounts.length === 1) {
          commit('setMSALAccount', currentAccounts[0]);
        }

        return;
      },

      async msalSignIn({ state, commit }, params = {}) {
        commit('setSigningIn', true);
        commit('setLoginRequest', params);
        return state.myMSALObj.loginRedirect(state.loginRequest);
      },

      async cityEmployeeSignIn({ state, commit }) {
        const config = { ...state.settings, ...{ cityEmployee: true }};
        commit('setMSALObject', config);
        return state.myMSALObj.loginRedirect(state.loginRequest);
      },

      async msalSignOut({ state, commit, dispatch }, redirectQueryParams = '') {
        commit('setSigningOut', true);

        let redirectURL = state.msalConfig.auth.postLogoutRedirectUri;
        if (typeof redirectQueryParams === 'string' && redirectQueryParams != '') {
          redirectURL += `?${redirectQueryParams}`;
        }

        const logoutRequest = {
          postLogoutRedirectUri: redirectURL,
        };
        await dispatch(state.signOutAction, {}, { root: true });
        return state.myMSALObj.logoutRedirect(logoutRequest);
      },

      msalForgotPassword({ state, commit }) {
        commit('setRedirectingForgotPassword', true);
        return state.myMSALObj.loginRedirect(state.b2cPolicies.authorities.forgotPassword);
      },

      async getAuthToken({ state, commit, dispatch }, params = {}) {
        commit('setTokenRequest', params);
        try {
          const response = await state.myMSALObj.acquireTokenSilent(state.tokenRequest);
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
              return state.myMSALObj.acquireTokenRedirect(state.tokenRequest);
            } catch (error) {
              if (state.debug) console.log(error);
            }
          } else {
            if (state.debug) console.log(error);
          }
        }
      },

      async handleRedirect({ state, commit, dispatch }, authTokenParams = {}) {
        if (state.debug) console.log('Attempting to handle redirect promise...');

        try {
          const response = await state.myMSALObj.handleRedirectPromise();
          if (state.debug) console.log("Redirect response: ", response);

          if (response) {    
            if (response.idTokenClaims['acr'].toUpperCase() === state.b2cPolicies.names.signUpSignIn.toUpperCase()) {
              // Set the state signing-in to true, the user is still signing into the system.
              commit('setSigningIn', true);

              // Set the phillyAccount information into the state
              await dispatch('selectAccount');

              // Let's get the SSO token.
              await dispatch('getAuthToken', authTokenParams);

              return response;
            } else if (response.idTokenClaims['acr'].toUpperCase() === state.b2cPolicies.names.forgotPassword.toUpperCase()) {
              if (state.debug) console.log('Went throu forgot password');
              if (state.forgotPasswordAction) {
                commit('setRedirectingForgotPassword', true);

                await dispatch(state.forgotPasswordAction, response, { root: true });
              }

              return response;
            }
          }

          commit('setSigningIn', false);
          return null;
        } catch (error) {
          if (state.debug) console.log('Error while handling redirect promise', error);

          if (error.errorMessage) {
            if (error.errorMessage.indexOf("AADB2C90118") > -1) {
              await dispatch('msalForgotPassword');
              return null;
            } else {
              // I believe it is better to throw and error and let the user handle it at convinience.
              if (state.errorHandler) {
                await dispatch(state.errorHandler, error, { root: true });
              } else {
                throw Error(error);
              }
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
      throw Error('You must pass-over the store when registering this plugin.');
    }

    let clientInfoObject = {};
    if (window.location.hash) {
      const regex = /client_info=([^&]+)/;
      const match = String(window.location.hash).match(regex);

      if (match && match[1]) {
        let clientInfoValue = decodeURIComponent(match[1]);
        clientInfoObject = JSON.parse(window.atob(clientInfoValue));
      }
    }

    // Dinamically register module
    const phillyAccount = ssoLib();
    store.registerModule('phillyAccount', phillyAccount);

    // set object
    if (String(clientInfoObject?.uid).toUpperCase().includes(B2C_1A_AD_SIGNIN_ONLY)) {
      config.cityEmployee = true;
    }
    store.commit('phillyAccount/setMSALObject', config);

    // Handle page refresh.
    store.dispatch('phillyAccount/selectAccount');

    if (!config.dontHandleRedirectAutomatically) {
      store.dispatch('phillyAccount/handleRedirect');
    }
  },
};
