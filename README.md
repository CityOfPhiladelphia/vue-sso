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
  signUpSignInPolicy: 'B2C_1A_SIGNUP_SIGNIN', // This is the default Sign In custom policy. (No MFA)

  signInAction: 'auth/authenticate', // Store action to be executed after obtaining the token. It pass over the token as a sole parameter.
  signOutAction: 'auth/signOut', // Store action to be executed before loging out redirection. No paramters are pass over the action.
};

Vue.use(VueSSO, { store, config }); // The store is required.
```
The Vue.install function executes the *handleRedirect* action automatically on each refresh, it means, the MSAL library is always checking if your refresh comes from a Microsoft B2C process. If you want to control this yourself on your own situation, e.g. only when the redirection is on "authentication" page, then, in your config object you add `dontHandleRedirectAutomatically: true` and then, you must `dispatch('phillyAccount/handleRedirect')` on your own.


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
