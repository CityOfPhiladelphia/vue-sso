# vue-sso
City of Philadelphia library for SSO login in vue.

This library executes a couple of functions redirecting to the City Of Philadelphia SSO service for Sign In, Sign Out and Password Update.

## How to use it.
Install it using `npm install @phila/vue-sso`.

And then in your `main.js` paste the following code, and update accordingly.

```js
import Vue from 'vue';
import VueSSO from '@phila/vue-sso';

const config = {
  clientId: '[my-client-uuid]', // Default is null. 
  b2cEnvirontment: 'PhilaB2CDev', // Production will be philab2c.
  authorityDomain: 'PhilaB2CDev.b2clogin.com', // Production will be login.phila.gov
  redirectUri: 'http://localhost:3000/auth', // Here is your redirect back URL.
  postLogoutRedirectUri: null, // The redirect URL when the ADB2C sign out event finishes.
  signUpSignInPolicy: 'B2C_1A_SIGNUP_SIGNIN', // This is the default Sign In custom policy. (No MFA)
  signInOnlyPolicy: "B2C_1A_AD_SIGNIN_ONLY", // This is the city employees signing only policy.
  resetPasswordPolicy: 'B2C_1A_PASSWORDRESET' // Default password reset policy
  dontHandleRedirectAutomatically: [Boolean], // If false, you will have to trigger the handleRedirectPromise function yourself. 
  signInAction: 'auth/authenticate', // Store action to be executed after obtaining the token. It pass over the token as a sole parameter.
  signOutAction: 'auth/signOut', // Store action to be executed before loging out redirection. No paramters are pass over the action.
  forgotPasswordAction: null, // Store action that is executed after the reset password flow.
  errorHandler: null, // Store action to handle all non-catched-by-default errors. 
  debug: [Boolean], // If true, the library will log a lot of information into the console. Use this on true only for development.
  tenantId: false, // In case of a custom tenant id like "login.phila.gov" it goes here in the parameter, if no one is entered, the library will use the default [env].onmicrosoft.com tenant value.
  loginRequestScopes: [ "openid", ...b2cScopes ], // The default configuration here is openid scope + initial mostly default read_data scopes.
  tokenRequestScopes: [ ...b2cScopes ], // The default here is the initial mostly default read_data scopes.
  state: null, // add an state value. https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-js-pass-custom-state-authentication-request
};

Vue.use(VueSSO, { store, config }); // The store is required.
```
The `Vue.install` function executes the *handleRedirect* action automatically on each refresh, it means, the MSAL library is always checking if your refresh comes from a Microsoft B2C process. If you want to control this yourself on your own situation, _e.g. only when the redirection is on "authentication" page_, then, in your config object you add `dontHandleRedirectAutomatically: true` and then, you must `store.dispatch('phillyAccount/handleRedirect')` on your own.


For you login, logout and forgot password buttons you can do. 

```html
<!-- Sign in -->
<button
  class="button is-primary"
  :class="{ 'is-loading': $store.state.phillyAccount.signingIn }"
  :disabled="$store.state.phillyAccount.signingIn"
  @click="$store.dispatch('phillyAccount/msalSignIn')"
>
  Sign in
</button>

<!-- City employee sign in -->
<button
  class="button is-primary"
  :class="{ 'is-loading': $store.state.phillyAccount.signingIn }"
  :disabled="$store.state.phillyAccount.signingIn"
  @click="$store.dispatch('phillyAccount/cityEmployeeSignIn')"
>
  City employee sign in 
</button>

<!-- Forgot password -->
<button
  class="button is-primary"
  :class="{ 'is-loading': $store.state.phillyAccount.redirectingForgotPassword }"
  :disabled="$store.state.phillyAccount.redirectingForgotPassword"
  @click="$store.dispatch('phillyAccount/msalForgotPassword');"
>
  Forgot password
</button>

<!-- Sign Out -->
<button
  class="button is-primary"
  :class="{ 'is-loading': $store.state.phillyAccount.signingOut }"
  :disabled="$store.state.phillyAccount.signingOut"
  @click="$store.dispatch('phillyAccount/msalSignOut')"
>
  Sign out
</button>
```

This library will inject into your vuex store (that's why the store is required) a new module called *phillyAccount* with the required statuses, mutations, and actions for page all redirection SSO process.


## Known issues:
* Currently, there is a cache issue when the user goes through "Create Account" and returns to the app through "Sign In." The App triggers a `No Cache Authority Error`. The temporary solution is to catch the error using the `errorHandler` parameter and trigger the sign-in policy back again. This will refresh the cache and log the user back in correctly.

```
if (error.errorCode === 'no_cached_authority_error') {
  dispatch('phillyAccount/msalSignIn', {}, { root: true });
  return;
}
```

## Change Log

### Wed. Aug. 30, 2023
- Updated the `state` parameter in the configuration. It expects and object. This object is returned as part of the payload to the `signInAction` in a pramater called `customPostbackObject`;
- There is a new action called `cityEmployeeSignIn`, it works the same way of `msalSignIn` but for city employess only.

### Tue. Sep. 12, 2023. 
- Please ignore version 1.3.1. 
- Version 1.4.0 adds the `Vue` parameter to the `ssoLib` functio so, it means, when running `Vue.use(VueSSO, { store, config });` the library passes down the Vue insteance to the configuration.

### Fri. Sep. 15, 2023
- Version 1.4.1 refactored the whole library to fix an issue when switching between "City employee" and "Regular user" sign in buttons. It should not affect anything from version 1.4.0 and ahead, just apply the fix.
