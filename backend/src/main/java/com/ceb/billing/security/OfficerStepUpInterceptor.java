package com.ceb.billing.security;

import com.ceb.billing.services.OfficerStepUpService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import java.io.IOException;
import java.util.Map;

@Component
public class OfficerStepUpInterceptor implements HandlerInterceptor {

    private static final String PASSWORD_HEADER = "X-Admin-Password";
    private static final String MUTATION_ATTRIBUTE = OfficerStepUpInterceptor.class.getName() + ".mutation";

    @Autowired
    private OfficerStepUpService officerStepUpService;

    @Autowired
    private ObjectMapper objectMapper;

    @Override
    public boolean preHandle(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull Object handler) throws IOException {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }
        OfficerStepUp stepUp = handlerMethod.getMethodAnnotation(OfficerStepUp.class);
        if (stepUp == null || !request.isUserInRole("OFFICER") || request.isUserInRole("ADMIN")) {
            return true;
        }

        String officerUsername = request.getUserPrincipal().getName();
        String recordId = resolveRecordId(request, stepUp.recordId());
        String password = request.getHeader(PASSWORD_HEADER);
        if (password == null) {
            writeError(response, 428, "ADMIN_PASSWORD_REQUIRED", "Admin password verification is required for this action.");
            return false;
        }

        OfficerStepUpResult result = officerStepUpService.verify(officerUsername, password, stepUp.action(), recordId);
        if (result == OfficerStepUpResult.INVALID) {
            writeError(response, 403, "ADMIN_PASSWORD_INVALID", "The Admin password is incorrect.");
            return false;
        }
        if (result == OfficerStepUpResult.RATE_LIMITED) {
            writeError(response, 429, "ADMIN_PASSWORD_RATE_LIMITED", "Too many failed Admin password attempts. Try again in 15 minutes.");
            return false;
        }

        request.setAttribute(MUTATION_ATTRIBUTE, new MutationAudit(officerUsername, stepUp.action(), recordId));
        return true;
    }

    @Override
    public void afterCompletion(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull Object handler,
            @Nullable Exception exception) {
        Object mutation = request.getAttribute(MUTATION_ATTRIBUTE);
        if (mutation instanceof MutationAudit audit && exception == null
                && response.getStatus() >= 200 && response.getStatus() < 400) {
            officerStepUpService.auditMutation(audit.officerUsername(), audit.action(), audit.recordId());
        }
    }

    private String resolveRecordId(HttpServletRequest request, String variableName) {
        if (variableName.startsWith("literal:")) {
            return variableName.substring("literal:".length());
        }
        Object variables = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (variables instanceof Map<?, ?> pathVariables) {
            Object id = pathVariables.get(variableName);
            if (id != null) {
                return id.toString();
            }
        }
        return "unknown";
    }

    private void writeError(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-store");
        objectMapper.writeValue(response.getWriter(), Map.of("code", code, "message", message));
    }

    private record MutationAudit(String officerUsername, String action, String recordId) {
    }
}
