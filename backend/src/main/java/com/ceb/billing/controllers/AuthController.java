package com.ceb.billing.controllers;

import com.ceb.billing.config.JwtUtils;
import com.ceb.billing.config.UserDetailsImpl;
import com.ceb.billing.entities.User;
import com.ceb.billing.models.JwtResponse;
import com.ceb.billing.models.LoginRequest;
import com.ceb.billing.models.MessageResponse;
import com.ceb.billing.repositories.UserRepository;
import com.ceb.billing.services.AuditLogService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        String role = userDetails.getRole();
        String jwt = jwtUtils.generateJwtToken(authentication, role);

        auditLogService.log("USER_LOGIN", "User " + userDetails.getUsername() + " successfully logged in");

        return ResponseEntity.ok(new JwtResponse(jwt, userDetails.getUsername(), role));
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
            signUpRequest.getRole()
        );

        userRepository.save(user);
        auditLogService.log("USER_REGISTER", "User " + user.getUsername() + " successfully registered with role " + user.getRole());

        return ResponseEntity.ok(new MessageResponse("User registered successfully!"));
    }

    @PostMapping("/setup")
    public ResponseEntity<?> setupDefaultUsers() {
        if (userRepository.count() == 0) {
            // Seed Admin
            User admin = new User("admin", encoder.encode("admin123"), "ADMIN");
            userRepository.save(admin);

            // Seed Billing Officer
            User officer = new User("officer", encoder.encode("officer123"), "OFFICER");
            userRepository.save(officer);

            // Seed Customer
            User viewer = new User("viewer", encoder.encode("viewer123"), "USER");
            userRepository.save(viewer);

            // Seed a customer account user
            User cust = new User("3202345091", encoder.encode("customer123"), "USER");
            userRepository.save(cust);

            auditLogService.log("SYSTEM_SETUP", "Default system users seeded (admin, officer, viewer, 3202345091)");
            return ResponseEntity.ok(new MessageResponse("Default users initialized: admin/admin123 (ADMIN), officer/officer123 (OFFICER), viewer/viewer123 (USER)"));
        }
        return ResponseEntity.badRequest().body(new MessageResponse("System already initialized. Setup skipped."));
    }
}
