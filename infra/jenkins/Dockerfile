# Jenkins LTS controller for local CI (PRD §14.1). The controller runs no builds
# (numExecutors: 0); the pipeline runs on an inbound agent on the host that has Node 24, pnpm and Docker.
FROM jenkins/jenkins:2.580.1-lts-jdk21
USER root
RUN git config --system --add safe.directory '*'
USER jenkins
COPY --chown=jenkins:jenkins plugins.txt /usr/share/jenkins/ref/plugins.txt
# The default updates.jenkins.io JSON redirect returned 404 inside Docker builds, so the metadata comes
# from the mirror and downloads go through updates.jenkins.io/download (redirects to a fast mirror).
# Latest compatible plugin versions are used so known security fixes are included.
ENV JENKINS_UC_DOWNLOAD=https://updates.jenkins.io/download
RUN jenkins-plugin-cli --jenkins-update-center https://mirrors.updates.jenkins.io/current/update-center.json \
      --plugin-file /usr/share/jenkins/ref/plugins.txt \
 && jenkins-plugin-cli --list --no-download > /usr/share/jenkins/ref/plugins-resolved.txt 2>&1 || true
COPY --chown=jenkins:jenkins casc.yaml /usr/share/jenkins/ref/casc.yaml
