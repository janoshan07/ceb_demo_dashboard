package com.ceb.billing.controllers;

import com.ceb.billing.config.JwtUtils;
import com.ceb.billing.config.UserDetailsImpl;
import com.ceb.billing.entities.User;
import com.ceb.billing.models.*;
import com.ceb.billing.repositories.UserRepository;
import com.ceb.billing.services.AuditLogService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private AuditLogService auditLogService;

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {
        // Verify credentials and issue the session token for every role without an OTP challenge.
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword()));

        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userDetails.getUsername()));

        String role = user.getRole();
        String jwt = jwtUtils.generateJwtTokenFromUsername(user.getUsername(), role);
        auditLogService.log("USER_LOGIN_SUCCESS",
                "User " + user.getUsername() + " authenticated with username and password.");
        return ResponseEntity.ok(new JwtResponse(jwt, user.getUsername(), role));
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody User signUpRequest) {
        if (userRepository.existsByUsername(signUpRequest.getUsername())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Username is already taken!"));
        }

        // Create new user's account
        User user = new User(
            signUpRequest.getUsername(),
            encoder.encode(signUpRequest.getPassword()),
            signUpRequest.getRole(),
            signUpRequest.getPhoneNumber() != null ? signUpRequest.getPhoneNumber() : "+94771234567"
        );

        userRepository.save(user);
        auditLogService.log("USER_REGISTER", "User " + user.getUsername() + " successfully registered with role " + user.getRole());

        return ResponseEntity.ok(new MessageResponse("User registered successfully!"));
    }

    @PostMapping("/setup")
    public ResponseEntity<?> setupDefaultUsers() {
        if (userRepository.count() == 0) {
            // Seed Admin with default phone
            User admin = new User("admin", encoder.encode("admin123"), "ADMIN", "+94771234567");
            userRepository.save(admin);

            // Seed Billing Officer
            User officer = new User("officer", encoder.encode("officer123"), "OFFICER", "+94772345678");
            userRepository.save(officer);

            // Seed Viewer
            User viewer = new User("viewer", encoder.encode("viewer123"), "USER", "+94773456789");
            userRepository.save(viewer);

            // Seed Customer account user
            User cust = new User("3202345091", encoder.encode("customer123"), "USER", "+94774567890");
            userRepository.save(cust);

            auditLogService.log("SYSTEM_SETUP", "Default system users seeded (admin, officer, viewer, 3202345091)");
            return ResponseEntity.ok(new MessageResponse("Default users initialized."));
        }
        return ResponseEntity.badRequest().body(new MessageResponse("System already initialized. Setup skipped."));
    }
}
