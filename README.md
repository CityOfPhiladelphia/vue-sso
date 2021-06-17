# vue-sso
City of Philadelphia library for SSO login in vue.

This library executes a couple of functions redirecting to the City Of Philadelphia SSO service for Sign In, Sign Out and Password Update.

## How to use it.
Install it using `npm install @phila/vue-sso`.

And then in your `main.js` paste the following code, and update accordingly.

```
// Inject $hello(msg) in Vue, context and store.
const config = {
  clientId: '[my-client-uuid]', // Default is null. 
  b2cEnvirontment: 'PhilaB2CDev', // Production will be philab2c.
  authorityDomain: 'PhilaB2CDev.b2clogin.com', // Production will be login.phila.gov
  redirectUri: 'http://localhost:3000/auth', // Here is your redirect back URL.
  signUpSignInPolicy: 'B2C_1A_SIGNUP_SIGNIN', // This is the default Sign In custom policy. (No MFA)

  signInAction: 'auth/authenticate', // Store action to be executed after obtaining the token. It pass over the token as a sole parameter.
  signOutAction: 'auth/signOut', // Store action to be executed before loging out redirection. No paramters are pass over the action.
};
Vue.use(vueSso, { store, config }); // The store is required.
```


This library will inject into your vuex store (that why the store is required) a new module called phillyAccount with the required statuses, mutations, and actions for page redirection SSO process.