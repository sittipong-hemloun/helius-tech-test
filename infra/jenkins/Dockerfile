# Jenkins LTS controller for local CI (PRD §14.1). The controller runs no builds
# (numExecutors: 0); the pipeline runs on an inbound agent on the host that has Node 24, pnpm and Docker.
FROM jenkins/jenkins:2.580.1-lts-jdk21
USER root
RUN git config --system --add safe.directory '*'
USER jenkins
COPY --chown=jenkins:jenkins plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt --latest false
COPY --chown=jenkins:jenkins casc.yaml /usr/share/jenkins/ref/casc.yaml
