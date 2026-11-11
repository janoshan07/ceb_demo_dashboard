package com.ceb.billing.config;

import com.ceb.billing.security.OfficerStepUpInterceptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class OfficerStepUpWebConfig implements WebMvcConfigurer {

    @Autowired
    @NonNull
    private OfficerStepUpInterceptor officerStepUpInterceptor;

    @Override
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        registry.addInterceptor(officerStepUpInterceptor);
    }
}
