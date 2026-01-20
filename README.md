# vue-sso
City of Philadelphia library for SSO login in Vue 3.

This library provides a Pinia plugin that integrates with Azure AD B2C for authentication, executing functions that redirect to the City Of Philadelphia SSO service for Sign In, Sign Out, and Password Reset.

## Requirements
- Vue 3
- Pinia
- A Pinia store with "auth" in its store ID (e.g., `authStore`, `userAuth`, etc.)

## Installation
Install it using `npm install @phila/vue-sso`.

## Setup
In your `main.js` or main application file, set up the plugin:

```js
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createPhillyAccountPlugin } from '@phila/vue-sso';

const app = createApp(App);
const pinia = createPinia();

const config = {
  clientId: '[my-client-uuid]', // Required. Your Azure AD B2C client ID.
  b2cEnvironment: 'PhilaB2CDev', // Default: 'PhilaB2CDev'. Production will be 'philab2c'.
  authorityDomain: 'PhilaB2CDev.b2clogin.com', // Default: 'PhilaB2CDev.b2clogin.com'. Production will be 'login.phila.gov'.
  redirectUri: 'http://localhost:8080/auth', // Default: 'http://localhost:8080/auth'. Your redirect back URL.
  postLogoutRedirectUri: null, // Default: null (falls back to redirectUri). The redirect URL when sign out completes.
  signUpSignInPolicy: 'B2C_1A_SIGNUP_SIGNIN', // Default: 'B2C_1A_SIGNUP_SIGNIN'. Sign In custom policy (No MFA).
  signInOnlyPolicy: 'B2C_1A_AD_SIGNIN_ONLY', // Default: 'B2C_1A_AD_SIGNIN_ONLY'. City employees sign-in only policy.
  resetPasswordPolicy: 'B2C_1A_PASSWORDRESET', // Default: 'B2C_1A_PASSWORDRESET'. Password reset policy.
  dontHandleRedirectAutomatically: false, // Default: false. If true, you must call handleRedirect() manually.
  signInAction: 'signIn', // Default: 'signIn'. Store action executed after obtaining token. Receives auth response as payload.
  signOutAction: 'signOut', // Default: 'signOut'. Store action executed before logout redirection. No parameters passed.
  forgotPasswordAction: null, // Default: null. Store action executed after password reset flow. Receives response as payload.
  errorHandler: null, // Default: null. Store action to handle non-default errors. Receives error as parameter.
  debug: false, // Default: false. If true, logs detailed information to console. Use only in development.
  tenantId: false, // Default: false. Custom tenant ID (e.g., 'login.phila.gov'). If false, uses [env].onmicrosoft.com.
  loginRequestScopes: null, // Default: ['openid', ...b2cScopes]. Scopes for login request.
  tokenRequestScopes: null, // Default: [...b2cScopes]. Scopes for token request.
  state: null, // Default: null. Object to pass custom state through auth flow. Returned in customPostbackObject.
};

pinia.use(createPhillyAccountPlugin(config));
app.use(pinia);
app.mount('#app');
```

**Important:** The plugin only attaches to Pinia stores whose store ID includes the word "auth" (case-insensitive). For example: `authStore`, `userAuth`, `authentication`, etc.

The plugin automatically executes `handleRedirect()` on initialization unless `dontHandleRedirectAutomatically: true` is set. This means the MSAL library checks if the page load comes from a Microsoft B2C redirect. If you want to control this manually (e.g., only on specific routes), set `dontHandleRedirectAutomatically: true` and call `store.handleRedirect()` yourself.


## Usage

### Store Setup

Define your Pinia store with actions that match the names you configured:

```javascript
import { defineStore } from 'pinia';

export const useAuthStore = defineStore('authStore', {
  actions: {
    // This action is called after successful authentication
    // payload contains: { accessToken, idToken, account, customPostbackObject, ... }
    signIn(payload) {
      console.log('Sign-in', payload);
      // Store the token, update user state, etc.
      this.userToken = payload.accessToken;
    },
    
    // This action is called before logout redirection
    signOut() {
      console.log('Sign-out');
      // Clear user data, etc.
      this.userToken = null;
    },
    
    // This action is called after password reset flow
    // payload contains the authentication response
    forgotPassword(payload) {
      console.log('Forgot password', payload);
    },
    
    // This action handles errors not caught by default
    // error contains the error object
    customErrorHandler(error) {
      console.log('Custom error handler', error);
    },
  },
  
  state: () => ({
    userToken: null,
  }),
});
```

### Component Usage

In your Vue component:

```javascript
<script setup>
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

// Access phillyAccount state
const signingIn = computed(() => authStore.$state.phillyAccount.signingIn);
const signingOut = computed(() => authStore.$state.phillyAccount.signingOut);
const redirectingForgotPassword = computed(() => 
  authStore.$state.phillyAccount.redirectingForgotPassword
);

// Access account and token
const msalAccount = computed(() => authStore.$state.phillyAccount.msalAccount);
const accessToken = computed(() => authStore.$state.phillyAccount.accessToken);

// Manually handle redirect (only if dontHandleRedirectAutomatically is true)
// authStore.handleRedirect();
</script>

<template>
  <!-- Sign in -->
  <button
    class="button is-primary"
    :class="{ 'is-loading': signingIn }"
    :disabled="signingIn"
    @click="authStore.msalSignIn()"
  >
    Sign in
  </button>

  <!-- City employee sign in -->
  <button
    class="button is-primary"
    :class="{ 'is-loading': signingIn }"
    :disabled="signingIn"
    @click="authStore.cityEmployeeSignIn()"
  >
    City employee sign in
  </button>

  <!-- Forgot password -->
  <button
    class="button is-primary"
    :class="{ 'is-loading': redirectingForgotPassword }"
    :disabled="redirectingForgotPassword"
    @click="authStore.msalForgotPassword()"
  >
    Forgot password
  </button>

  <!-- Sign Out -->
  <button
    class="button is-primary"
    :class="{ 'is-loading': signingOut }"
    :disabled="signingOut"
    @click="authStore.msalSignOut()"
  >
    Sign out
  </button>
</template>
```

## Available Methods

The plugin injects the following public methods into your store:

- `msalSignIn(params)` - Initiates sign-in redirect (regular users)
- `cityEmployeeSignIn(params)` - Initiates sign-in redirect (city employees only)
- `msalSignOut(redirectQueryParams)` - Initiates sign-out redirect (optional query params string)
- `msalForgotPassword()` - Initiates password reset flow
- `handleRedirect(authTokenParams)` - Handles redirect promise after authentication (only needed if `dontHandleRedirectAutomatically: true`)

## State Properties

The plugin adds a `phillyAccount` object to your store state with the following properties:

- `myMSALObj` - The MSAL PublicClientApplication instance
- `customPostbackObject` - Custom state object passed through auth flow
- `msalAccount` - Current authenticated account
- `accessToken` - Current access token
- `signingIn` - Boolean indicating if sign-in is in progress
- `signingOut` - Boolean indicating if sign-out is in progress
- `redirectingForgotPassword` - Boolean indicating if password reset is in progress
- `signingInPolicy` - Current policy used ('signUpSignIn' or 'signInOnly')
- `b2cScopes` - Array of B2C scopes
- `settings` - Configuration settings object
- `b2cPolicies` - B2C policy configuration
- `msalConfig` - MSAL configuration object
- `loginRequest` - Login request configuration
- `tokenRequest` - Token request configuration


## Known Issues

* **Cache Issue**: There is a cache issue when a user goes through "Create Account" and returns to the app through "Sign In." The app may trigger a `No Cache Authority Error`. The temporary solution is to catch the error using the `errorHandler` parameter and trigger the sign-in policy again. This will refresh the cache and log the user back in correctly.

```javascript
// In your error handler action
customErrorHandler(error) {
  if (error.errorCode === 'no_cached_authority_error') {
    authStore.msalSignIn();
    return;
  }
  // Handle other errors...
}
```

## Configuration Details

### State Parameter

The `state` configuration parameter accepts an object that will be passed through the authentication flow. This object is returned in the `signInAction` payload as `customPostbackObject`. The state is base64 encoded and passed in the authentication request.

```javascript
const config = {
  // ... other config
  state: {
    returnUrl: '/dashboard',
    userId: '12345',
    // Any custom data you want to pass through
  },
};
```

### Scopes

By default, the library sets up scopes automatically:
- `loginRequestScopes`: `['openid', ...b2cScopes]` where `b2cScopes` includes `https://[b2cEnvironment].onmicrosoft.com/api/read_data`
- `tokenRequestScopes`: `[...b2cScopes]`

You can override these by providing `loginRequestScopes` and `tokenRequestScopes` in your config.

## Change Log

### Version 1.0.0 (Current)
- Vue 3 and Pinia support
- Pinia plugin architecture
- Automatic redirect handling
- Support for multiple authentication policies (sign-up/sign-in, sign-in only, password reset)
- City employee sign-in support
- Custom state passing through authentication flow
- Error handling with custom error handlers
- Debug mode for development