FROM alpine:3.18
RUN apk add --no-cache curl

COPY crontab /etc/crontabs/root
COPY run-job.sh /run-job.sh

# Create entrypoint script to fix CRLF and permissions at runtime (handling volume mounts)
RUN printf '#!/bin/sh\n\
    mkdir -p /etc/crontabs-clean\n\
    # Fix CRLF (Windows line endings) and ensure trailing newline\n\
    cat /etc/crontabs/root | tr -d "\\r" > /etc/crontabs-clean/root\n\
    echo "" >> /etc/crontabs-clean/root\n\
    chmod 0644 /etc/crontabs-clean/root\n\
    \n\
    # Fix CRLF for run-job.sh and make executable\n\
    cat /run-job.sh | tr -d "\\r" > /usr/local/bin/run-job.sh\n\
    chmod +x /usr/local/bin/run-job.sh\n\
    \n\
    # Run crond using the cleaned crontab directory\n\
    exec crond -f -c /etc/crontabs-clean -L /dev/stdout\n\
    ' > /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
