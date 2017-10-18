pipeline {
    agent { label 'docker' }

    options {
        gitLabConnection('gitlab')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }
    triggers {
        gitlab(triggerOnPush: true, triggerOnMergeRequest: true, branchFilterType: 'All')
        cron('1,16,31,46 8-18 * * 1-5')
    }

    post {
        success {
            publishHTML([allowMissing: false, alwaysLinkToLastBuild: false, keepAll: false, reportDir: 'public', reportFiles: 'index.html', reportName: 'Visualization', reportTitles: ''])
            updateGitlabCommitStatus name: env.JOB_NAME, state: 'success'
        }
        failure {
            updateGitlabCommitStatus name: env.JOB_NAME, state: 'failed'
        }
    }

    stages {
        stage('Build') {
            steps {
                updateGitlabCommitStatus name: env.JOB_NAME, state: 'running'
                sh 'docker build -t $DOCKER_REGISTRY/gros-bigboat-status .'
            }
        }
        stage('Push') {
            when { branch 'master' }
            steps {
                sh 'docker push $DOCKER_REGISTRY/gros-bigboat-status:latest'
            }
        }
        stage('Collect') {
            agent {
                docker {
                    image '$DOCKER_REGISTRY/gros-data-analysis-dashboard'
                    args '--tmpfs /tmp'
                    reuseNode true
                }
            }
            steps {
                withCredentials([file(credentialsId: 'data-analysis-config', variable: 'ANALYSIS_CONFIGURATION')]) {
                    sh '/bin/bash -c "rm -rf $PWD/output && mkdir $PWD/output && cd /home/docker && cp $ANALYSIS_CONFIGURATION config.yml && Rscript report.r --report bigboat_status --log INFO --output $PWD/output"'
                }
            }
        }
        stage('Visualize') {
            agent {
                docker {
                    image '$DOCKER_REGISTRY/gros-bigboat-status'
                    reuseNode true
                }
            }
            steps {
                sh 'rm -rf public/data/'
                sh 'mv output/ public/data/'
                sh 'rm -rf node_modules/'
                sh 'ln -s /usr/src/app/node_modules .'
                sh 'npm run production -- --context=$PWD'
            }
        }
    }
}
