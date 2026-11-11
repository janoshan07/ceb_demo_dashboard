package com.ceb.billing.controllers;

import com.ceb.billing.config.JwtUtils;
import com.ceb.billing.config.UserDetailsImpl;
import com.ceb.billing.entities.User;
import com.ceb.billing.models.JwtResponse;
import com.ceb.billing.models.LoginRequest;
import com.ceb.billing.repositories.UserRepository;
import com.ceb.billing.services.AuditLogService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.Optional;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtUtils jwtUtils;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private AuthController authController;

    @Test
    void loginReturnsJwtImmediatelyAfterPasswordAuthentication() {
        User user = new User("officer", "hashed-password", "OFFICER");
        UserDetailsImpl principal = UserDetailsImpl.build(user);
        UsernamePasswordAuthenticationToken authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        principal, null, principal.getAuthorities());
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(authentication);
        when(userRepository.findByUsername("officer")).thenReturn(Optional.of(user));
        when(jwtUtils.generateJwtTokenFromUsername("officer", "OFFICER")).thenReturn("jwt-token");

        ResponseEntity<?> response = authController.authenticateUser(
                new LoginRequest("officer", "password"));

        assertEquals(200, response.getStatusCode().value());
        JwtResponse body = Objects.requireNonNull((JwtResponse) response.getBody());
        assertEquals("jwt-token", body.getToken());
        assertEquals("officer", body.getUsername());
        assertEquals("OFFICER", body.getRole());
        verify(auditLogService).log(
                "USER_LOGIN_SUCCESS",
                "User officer authenticated with username and password.");
    }
}
