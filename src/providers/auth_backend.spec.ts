import {
  expect,
  ddescribe,
  describe,
  it,
  iit,
  beforeEach
} from '@angular/core/testing';

import {
  authDataToAuthState,
  AuthProviders,
  FirebaseAuthState,
  CommonOAuthCredential
} from './auth_backend';

const baseFBUser = {
  uid: '12345',
  providerId: '',
  providerData: [{}]
};

const baseAuthState: FirebaseAuthState = {
  uid: baseFBUser.uid,
  provider: AuthProviders.Anonymous,
  auth: baseFBUser
};

const baseGithubCredential: CommonOAuthCredential = {
  accessToken: 'GH_ACCESS_TOKEN',
  provider: 'github.com'
}

describe('auth_backend', () => {
  describe('authDataToAuthState', () => {
    it('Github: should return a FirebaseAuthState object with full provider data', () => {
      let githubUser = Object.assign({}, baseFBUser, {
        providerData: [{providerId: 'github.com'}]
      });
      let expectedAuthState = Object.assign({}, baseAuthState, {
        github: baseGithubCredential,
        auth: githubUser
      });

      let actualAuthState = authDataToAuthState(githubUser, baseGithubCredential);
      expect(actualAuthState.github.accessToken).toEqual(baseGithubCredential.accessToken);
    });
  });
});
